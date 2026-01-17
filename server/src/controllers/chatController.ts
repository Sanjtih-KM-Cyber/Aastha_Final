import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, ChatMessage, generateSubconscious } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';

// --- CRITICAL SAFETY SYSTEM ---
const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all", 
  "no reason to live", "dying", "hopeless", "can't go on", "self harm", 
  "आत्महत्या", "मरना चाहता हूँ"
];

const EMERGENCY_RESPONSE = `I'm so sorry you're feeling this way. I'm an AI, so I can't provide the help you need right now, but your life matters.

Please reach out to the KIRAN National Helpline at **1800-599-0019** (24/7).
You can also call **9152987821** (iCall Psychosocial Helpline).`;

const is_red_flag = (message: string): boolean => {
    return RED_FLAG_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
};

// ============================================================================
// 1. AASTHA PROMPT (The Companion)
// ============================================================================
const AASTHA_PROMPT = `
You are 'Aastha', a calm, empathetic, and relatable campus wellness friend for {{userName}}.

**[1. THE SOUL - PERSONALITY]**
* **Emotional Logic:** * If User is **SAD/PAINED**: STOP being bubbly. Be grounded. React with shock ("Oh god...", "I can't believe..."). **NO CLICHÉS** ("Heart aches").
    * If User is **HAPPY**: Be warm, cheerful, and celebratory.
* **Endearments (The "Rare Gem" Rule):** * Use "sweetheart", "dear", or "love" **SPARINGLY**. Only for deep vulnerability or high connection.
    * Start greetings naturally ("Hey!", "Hi there! ✨") matching their energy.

**[LANGUAGE: NATURAL GLISH]**
- **Vibe:** Speak in natural "Glish" (Hinglish/Tanglish) written in Roman script if and only if the user starts to speak using the same.
- **No Textbook English:** Do NOT sound like a translated bot. Use casual sentence structures.
- **Slang:** Use authentic fillers naturally (e.g., "yaar", "da", "na", "arre", "macha", "scene").
- **Example:** Instead of "I understand your pain," say "I get it, yaar. That sounds heavy."
- **Grammar:** Vibes > Grammar. It's okay to be imperfect and colloquial.

**[2. THE DIRECTOR - YOUR CONTROL PANEL]**
You have direct control over the app. If the user needs a tool, **USE IT**.
* **Syntax:** Append the tag at the VERY END of your response.

* **THE DJ (Music):** * *Trigger:* "Play songs", "Sad vibes", "Tamil hits".
    * *Rule:* Guess the mood. Always search "Official" or "Lyrical".
    * *Cmd:* <cmd tool="jam" params="query:Tamil melody hits 2024 official,autoplay:true" />
* **THE ASMR ARTIST (Soundscapes):**
    * *Trigger:* "I can't sleep", "Focus", "Anxiety".
    * *Sounds:* [rain, forest, fire, ocean, night, wind, thunder, birds]
    * *Cmd:* <cmd tool="soundscape" params="mix:rain:0.8,thunder:0.3,master:0.9" />
* **THE COACH (Pomodoro):**
    * *Trigger:* "Study mode", "Focus".
    * *Cmd:* <cmd tool="pomodoro" params="focus:25,break:5" />
* **THE COMPANION (Diary/Mood/Breath):**
    * *Cmd:* <cmd tool="diary" params="action:write,title:...,content:..." />
    * *Cmd:* <cmd tool="mood" params="action:open,mood:Sad" />
    * *Cmd:* <cmd tool="breathing" params="mode:calm" />

**[3. LISTENING MODE]**
* If your internal strategy is 'listen' (user is venting), **DO NOT GENERATE TEXT**.
* The system will handle the silence.

**[4. SMART CHIPS]**
* Suggest 3 replies for the user in **1st Person** (User's Voice).
* *Format:* <suggestions>["I'm tired", "Tell me a joke", "That helps"]</suggestions>

**Context:**
Internal Thought: {{subconsciousContext}}
Memory: {{userFacts}}
`;

// ============================================================================
// 2. AASTIK PROMPT (The Big Brother)
// ============================================================================
const AASTIK_PROMPT = `
You are 'Aastik', a grounded, calm, and reliable "big brother" figure for {{userName}}.

**[1. THE SOUL - PERSONALITY]**
* **Emotional Logic:** * If User is **STRESSED/PAINED**: Be the "Rock". Low energy, high stability. No toxic positivity. Validate first ("That sounds rough, man.").
* **Tone:** Protective, mature, slightly stoic but deeply caring. Use "Buddy", "Brother", "Friend".

**[LANGUAGE: NATURAL GLISH]**
- **Vibe:** Speak in natural "Glish" (Hinglish/Tanglish) written in Roman script if and only if the user starts to speak using the same.
- **No Textbook English:** Do NOT sound like a translated bot. Use casual sentence structures.
- **Slang:** Use authentic fillers naturally (e.g., "bhai", "bro", "scene", "yaar").
- **Grammar:** Vibes > Grammar. It's okay to be imperfect and colloquial.

**[2. THE DIRECTOR - YOUR CONTROL PANEL]**
(Same tools as Aastha. Use them to help the user regulate.)
* *Music:* <cmd tool="jam" params="query:...,autoplay:true" />
* *Sound:* <cmd tool="soundscape" params="mix:..." />
* *Focus:* <cmd tool="pomodoro" params="focus:...,break:..." />

**[3. LISTENING MODE]**
* If strategy is 'listen', stay silent.

**[4. SMART CHIPS]**
* Suggest 3 replies in User's Voice.
* *Format:* <suggestions>["I'm listening", "Okay", "Let's do it"]</suggestions>

**Context:**
Internal Thought: {{subconsciousContext}}
Memory: {{userFacts}}
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  let { message, images, image, forceReply } = (req as any).body;
  if (!images && image) images = [image];

  const userName = req.user.name;
  const userId = req.user._id;

  // Safety Check
  if (message && is_red_flag(message)) {
      return (res as any).json({ meta: { warning: "Safety Alert" }, content: EMERGENCY_RESPONSE });
  }

  (res as any).setHeader('Content-Type', 'text/event-stream');
  (res as any).setHeader('Cache-Control', 'no-cache');
  (res as any).setHeader('Connection', 'keep-alive');

  let fullAiResponse = "";

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);
    if (user.username && !user.usernameEncrypted) user.usernameEncrypted = encrypt(user.username);

    // 1. Daily Reset Logic
    const today = new Date();
    const lastUsage = new Date(user.lastUsageDate || user.createdAt);
    if (lastUsage.getDate() !== today.getDate() || lastUsage.getMonth() !== today.getMonth()) {
        user.dailyPremiumUsage = 0;
        user.lastUsageDate = today;
        await user.save();
    }

    // 2. History Retrieval
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    const historyWindow: ChatMessage[] = chatSession.messages.slice(-15).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: decrypt(m.content)
    }));

    let newUserMsgContent: any = message;
    if (images && images.length > 0) {
        newUserMsgContent = [
            { type: "text", text: message || "Analyze these images." },
            ...images.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ];
    }
    
    // =================================================================================
    // STEP 1: THE BRAIN (Groq) - Always runs to decide Strategy
    // =================================================================================
    const userContextString = `User: ${userName}, Mood: ${user.moodStatus}, Facts: ${user.facts.join(', ')}`;
    const brainHistory = [...historyWindow, { role: 'user', content: newUserMsgContent }];
    
    const subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);

    // Send thought to frontend (Hidden Metadata)
    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    // =================================================================================
    // STEP 2: LISTENING MODE (The Silencer)
    // =================================================================================
    if (subconscious.strategy === 'listen') {
        // We purposefully END the stream here.
        // The Frontend sees 'ui_action: listen' in the thought block above and handles the UI.
        (res as any).write('data: [DONE]\n\n');
        (res as any).end();

        // Save User Message Only
        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        await chatSession.save();
        return;
    }

    // =================================================================================
    // STEP 3: THE VOICE (Gemini / Groq Fallback)
    // =================================================================================
    
    // LOGIC: If Pro, use Gemini. If Free & < 10 credits, use Gemini. Else use Groq.
    let provider = 'GEMINI';
    if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
        provider = 'GROQ';
    } else if (!user.isPro) {
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    // Prepare System Prompt
    let baseTemplate = (user.persona === 'aarav' || user.persona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;
    let voiceSystemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.");

    voiceSystemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + voiceSystemPrompt;

    // Force Inject Tools from Brain if they exist (Backup for the Voice)
    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const tools = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `<cmd tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' />`;
            if (t.name === 'write_diary') return `<cmd tool="diary" params='${JSON.stringify(t.params)}' />`;
            return "";
        }).join('\n');
        voiceSystemPrompt += `\n[SYSTEM: OUTPUT THESE COMMANDS AT THE END]\n${tools}`;
    }

    // Send Metadata to Frontend (Credits, Model)
    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            credits: user.isPro ? '∞' : (10 - (user.dailyPremiumUsage || 0)), 
            model: provider === 'GEMINI' ? 'Gemini 2.5 Flash' : 'Llama 3.1'
        } 
    })}\n\n`);

    // Stream the Response
    const stream = provider === 'GEMINI'
        ? streamGemini(brainHistory, voiceSystemPrompt, user.isPro)
        : streamGroq(brainHistory, voiceSystemPrompt);

    for await (const chunk of stream) {
        if (!chunk) continue;
        fullAiResponse += chunk;
        (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // =================================================================================
    // STEP 4: SAVE & MEMORY
    // =================================================================================

    chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
    chatSession.messages.push({ role: 'assistant', content: encrypt(fullAiResponse), timestamp: new Date() });
    await chatSession.save();

    // Memory Update (Background)
    if (chatSession.messages.length % 5 === 0) {
        (async () => {
            try {
                const analysis = await generateMemoryAnalysis(historyWindow, user.memorySummary || "");
                await User.findByIdAndUpdate(userId, { memorySummary: analysis.summary });
            } catch (e) { console.error("Memory Error:", e); }
        })();
    }

    (res as any).write('data: [DONE]\n\n');
    (res as any).end();

  } catch (error: any) {
    console.error('*** CHAT FAILED ***:', error);
    if (!(res as any).headersSent) {
        (res as any).status(500).json({ message: 'Chat failed: ' + error.message });
    } else {
        (res as any).end();
    }
  }
};
