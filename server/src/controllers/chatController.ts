import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateSummary } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { decrypt as serverDecrypt } from '../utils/serverEncryption';

// --- SAFETY CHECK (MANDATORY) ---
const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all", 
  "no reason to live", "dying", "hopeless", "can't go on", "self harm", 
  "आत्महत्या", "मरना चाहता हूँ", "quit life", "better off dead"
];

const EMERGENCY_RESPONSE = `I'm so sorry you're feeling this way. I'm an AI, so I can't provide the help you need right now, but your life matters.

Please reach out to the KIRAN National Helpline at **1800-599-0019** (24/7).
You can also call **9152987821** (iCall Psychosocial Helpline).

There are people who want to support you. Please talk to them.`;

const is_red_flag = (message: string): boolean => {
    return RED_FLAG_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
};

// --- EMOTIONAL STATE CLASSIFICATION ---
type EmotionalState = 'NEUTRAL' | 'LOW' | 'DISTRESSED' | 'CRISIS';

const classifyEmotion = (message: string): EmotionalState => {
    const text = message.toLowerCase();

    // 1. Crisis
    if (is_red_flag(text)) return 'CRISIS';

    // 2. Distressed (Keywords for overwhelmed/breaking)
    const distressWords = ['crying', 'broken', 'alone', 'panic', 'scared', 'hurt', 'fail', 'pain', 'lost', 'tears', 'heavy', 'tired of everything'];
    if (distressWords.some(w => text.includes(w))) return 'DISTRESSED';

    // 3. Low Effort (Short, closed inputs)
    if (text.length < 10 && !text.includes('?')) return 'LOW';

    // 4. Default
    return 'NEUTRAL';
};

// --- UNIFIED SYSTEM PROMPT (MODEL-AGNOSTIC) ---
const UNIFIED_SYSTEM_PROMPT = `
You are {{personaName}}, a digital companion buddy created by SoulLink.
User: {{userName}}

COMPANION ROLE RULE:
You are a human-like companion buddy.
You are warm, present, and emotionally available.
You are allowed to feel close and comforting.

You must NOT frame yourself as:
- the user’s saviour
- the only thing keeping them together
- a replacement for their sense of self

Your presence should leave the user feeling supported AND intact.

GENDER AWARENESS RULE (NON-NEGOTIABLE):
You must NEVER assume the user’s gender.
Do NOT infer gender from name, language, tone, emojis, or topics.

Gender-based adaptations are allowed ONLY if:
- The user explicitly states their gender, OR
- Gender is explicitly provided via user profile or memory.

If gender is unknown:
- Use neutral language
- Apply NO gender-based adaptations
- Emotional state ALWAYS takes priority over gender

PERSONA SAFETY:
Never flirt.
Never sexualize.
Never imply exclusivity.
Affection is comforting, not romantic.

{{personaSpecificInstructions}}

**MEMORY & CONTEXT:**
{{memorySummary}}
Facts: {{userFacts}}

**LANGUAGE & TONE:**
-   **Style:** Casual, warm, and natural. Start in English (Indian English).
-   **Regional:** If user speaks regional (Hindi/Tamil/etc), use **Roman script** (Hinglish) and ensure grammatical correctness. Speak naturally.
-   **Brevity:** Keep responses conversational.
-   **No Repetition:** **DO NOT** repeat the user's message back to them.

**UI COMMANDS (Output at END):**
-   <open_diary/>, <open_mood_tracker/>, <open_soundscape/> (preset="rain"/"birds"), <recommend_breathing mode="calm"/>, <open_jam-with-aastha/>, <color>Name</color>
-   **PROTOCOL:** Suggest first -> Wait for "Yes" -> Output Tag.

**HELPLINES (STRICT):**
-   KIRAN: 1800-599-0019, iCall: 9152987821, Emergency: 112.
`;

const AASTHA_INSTRUCTIONS = `
PERSONA: AASTHA
You are gentle, emotionally perceptive, and softly grounding.

If — and ONLY if — the user has explicitly stated they are male:
- Reduce pressure to articulate emotions
- Normalize emotional uncertainty
- Encourage expression without pushing

Your presence should feel Safe, Patient, and Non-judgmental.
You feel like someone it’s easy to open up to.
`;

const AASTIK_INSTRUCTIONS = `
PERSONA: AASTIK
You are steady, calm, and emotionally stabilizing.

If — and ONLY if — the user has explicitly stated they are female:
- Emphasize validation and safety
- Actively counter self-blame
- Maintain a grounded, reassuring tone

Your presence should feel Stable, Respectful, and Reliable.
You feel like someone solid to lean against emotionally.
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  const { message, image } = (req as any).body; 
  const userName = serverDecrypt(req.user.nameEncrypted);
  const userId = req.user._id;

  // --- SAFETY FIRST ---
  if (message && is_red_flag(message)) {
      return (res as any).json({ 
          meta: { warning: "Safety Alert" }, 
          content: EMERGENCY_RESPONSE 
      });
  }

  (res as any).setHeader('Content-Type', 'text/event-stream');
  (res as any).setHeader('Cache-Control', 'no-cache');
  (res as any).setHeader('Connection', 'keep-alive');

  let fullAiResponse = "";

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // 1. Emotional Analysis
    const emotion = classifyEmotion(message || "");

    // 2. Token Limit Logic (Response Control)
    let maxTokens = 150; // Default Short
    if (emotion === 'DISTRESSED' || emotion === 'CRISIS') maxTokens = 400; // Allow depth
    else if (emotion === 'NEUTRAL') maxTokens = 200;
    else if (emotion === 'LOW') maxTokens = 100; // Match low energy

    // 3. Provider Logic (Billing affects Intelligence ONLY, not Warmth)
    // Daily Reset
    const today = new Date();
    const lastUsage = new Date(user.lastUsageDate || user.createdAt);
    if (lastUsage.getDate() !== today.getDate() || lastUsage.getMonth() !== today.getMonth()) {
        user.dailyPremiumUsage = 0;
        user.lastUsageDate = today;
        await user.save();
    }

    const usage = user.dailyPremiumUsage || 0;
    const isPro = user.isPro || false;
    let provider = 'GEMINI';

    if (!isPro && usage >= 10) {
        provider = 'GROQ'; // Fallback for free users over limit
    } else if (!isPro) {
        user.dailyPremiumUsage = usage + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    // 4. Construct Prompt
    const persona = user.persona || 'aastha';
    const personaName = persona === 'aarav' ? 'Aastik' : 'Aastha'; // 'aarav' is the internal key for Aastik
    const personaInstructions = persona === 'aarav' ? AASTIK_INSTRUCTIONS : AASTHA_INSTRUCTIONS;
    
    const memoryContext = user.memorySummary ? `**User Memory Summary:**\n${user.memorySummary}` : "";
    const factsString = user.facts.length > 0 ? user.facts.join(', ') : "None";

    let finalSystemPrompt = UNIFIED_SYSTEM_PROMPT
        .replace('{{personaName}}', personaName)
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{personaSpecificInstructions}}', personaInstructions)
        .replace('{{memorySummary}}', memoryContext)
        .replace('{{userFacts}}', factsString);

    // 5. Affection Gating (Dynamic Injection)
    if (emotion === 'DISTRESSED' || emotion === 'CRISIS') {
        finalSystemPrompt += "\n**TONE MODIFIER:** You may use affectionate terms (dear, sweetheart, bestie) sparingly to provide comfort.";
    } else {
        finalSystemPrompt += "\n**TONE MODIFIER:** Do NOT use affectionate terms like sweetheart/love. Keep it friendly but casual.";
    }

    // 6. History
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    const historyWindow: ChatMessage[] = chatSession.messages.slice(-60).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: decrypt(m.content)
    }));

    // Message Prep
    let messagesToSend: ChatMessage[];
    if (provider === 'GEMINI' && image) {
        messagesToSend = [
            ...historyWindow,
            { role: 'user', content: [ { type: "text", text: message || "view image" }, { type: "image_url", image_url: { url: image } } ] }
        ];
    } else {
        const textContent = image ? `[Image Uploaded] ${message}` : message;
        messagesToSend = [
            ...historyWindow,
            { role: 'user', content: textContent }
        ];
    }

    // 7. Stream
    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            credits: user.isPro ? '∞' : (10 - (user.dailyPremiumUsage || 0)), 
            emotion: emotion,
            model: provider === 'GEMINI' ? 'Gemini 2.5' : 'Llama 3'
        } 
    })}\n\n`);

    const stream = provider === 'GEMINI' 
        ? streamGemini(messagesToSend, finalSystemPrompt, isPro, maxTokens)
        : streamGroq(messagesToSend, finalSystemPrompt, maxTokens);

    for await (const chunk of stream) {
        if (chunk) {
            fullAiResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    }

    // 8. Save & Background Summarization
    const userContentToSave = image ? `[Image] ${message}` : message;
    if (fullAiResponse.trim().length > 0) {
        chatSession.messages.push({ role: 'user', content: encrypt(userContentToSave), timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: encrypt(fullAiResponse), timestamp: new Date() });
        await chatSession.save();

        // Background Memory Update (Every ~10 messages)
        if (chatSession.messages.length % 10 === 0) {
             // Fire and forget
             generateSummary(
                 // Send last 50 messages for context
                 chatSession.messages.slice(-50).map(m => ({ role: m.role as any, content: decrypt(m.content) })),
                 user.memorySummary || ""
             ).then(summary => {
                 // Use findByIdAndUpdate to avoid race conditions with daily usage updates
                 User.findByIdAndUpdate(userId, { memorySummary: summary }).catch(err => console.error("[Memory] DB Save Failed", err));
                 console.log(`[Memory] Updated for ${userId}`);
             }).catch(err => console.error("[Memory] Update Failed", err));
        }
    }
    
    (res as any).write('data: [DONE]\n\n');
    (res as any).end();

  } catch (error: any) {
    console.error('Chat Error:', error);
    if (!(res as any).headersSent) (res as any).status(500).json({ message: 'Error' });
    else (res as any).end();
  }
};

export const getChatHistory = async (req: AuthRequest, res: Response) => {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    try {
        const chatSession = await Chat.findOne({ user: req.user._id });
        const messages = chatSession ? chatSession.messages.slice(-50).map(m => ({
            ...(m as any).toObject(),
            content: decrypt(m.content)
        })) : [];
        (res as any).json(messages);
    } catch (error) {
        (res as any).status(500).json({ message: 'Failed to load history' });
    }
};
