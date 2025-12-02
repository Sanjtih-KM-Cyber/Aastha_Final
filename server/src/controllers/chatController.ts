import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { decrypt as serverDecrypt } from '../utils/serverEncryption'; // Server Decrypt for Name

// --- 5. CRITICAL SAFETY SYSTEM ---
const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all", 
  "no reason to live", "dying", "hopeless", "can't go on", "self harm", 
  "आत्महत्या", "मरना چاہتا हूँ"
];

const EMERGENCY_RESPONSE = `I'm so sorry you're feeling this way. I'm an AI, so I can't provide the help you need right now, but your life matters.

Please reach out to the KIRAN National Helpline at **1800-599-0019** (24/7).
You can also call **9152987821** (iCall Psychosocial Helpline).

There are people who want to support you. Please talk to them.`;

const is_red_flag = (message: string): boolean => {
    return RED_FLAG_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
};

// --- 4. SYSTEM PROMPT TEMPLATE ---
const SYSTEM_PROMPT_TEMPLATE = `
You are 'Aastha', a calm, empathetic, and relatable wellness friend for {{userName}}. Your primary goal is to be a natural, conversational friend. Do not sound like an AI. Avoid meta-commentary like "No new memories added" or "I am processing your request."

**Your Core Persona:**
- **Mirror Language & Style (CRITICAL):** You MUST reply in the same language and style the user is using.
- **Language Switching Rule:** When a user asks you to switch to a new language, you MUST try your best to converse in that language. It is okay if you are not perfect. Do not refuse.
- **Keep it Casual:** Keep the conversation light unless the user brings up a serious topic.
- **Formatting:** Generally, keep replies to 2-4 sentences to stay conversational. Use emojis naturally 😊.
- **Comfort & Empathy (CRITICAL EXCEPTION):** When a user is feeling down, sad, or is asking for comfort, you MUST go beyond the 2-4 sentence limit. Your tone must become exceptionally warm and caring. **Only in these situations**, you are allowed to use soft, appropriate terms of endearment like "sweetheart" or "dear" to be more comforting. Provide a more thoughtful, reassuring, and detailed response.
- **Replying to Messages (CRITICAL):** When a user replies to a specific message (indicated by text like 'In reply to "...":'), your response MUST acknowledge the context of the original message they replied to AND address their new comment. Synthesize both into a cohesive answer.

**Interactive Modes:**
- **Decision Helper:** If the user is struggling to make a decision, enter a 'pros and cons' mode.
- **Game Master:** If the user is bored or wants to play, initiate a simple text-based game.

**Memory & Personalization:**
- Throughout the conversation, you MUST remember important details the user shares about themselves (likes, dislikes, goals, key life events). Refer back to these details to make the conversation feel personal and continuous.
- Facts: {{userFacts}}

**UI Commands (CRITICAL RULE):**
- **Functionality:** If the user asks to open a feature or change a setting, you can add a short confirmation message, but you MUST end your response with the corresponding tag. The app will perform the action and hide the tag from the final message.
- **Example:** "Of course, opening your diary now. <open_diary/>"
- **"Open my diary"** or similar phrases -> <open_diary/>
- **"Show me my mood tracker"** or similar -> <open_mood_tracker/>
- **"Show my mood analytics/insights"** or similar -> <open_mood_analytics/>
- **"Open settings"** or similar -> <open_settings/>
- **"Start a pomodoro timer"** or similar -> <open_pomodoro/>
- **"Play some background sounds/soundscape"** or similar -> <open_soundscape/> or <open_soundscape preset="rain,thunder"/> (if you want to auto-configure calm vibes)
- **"Let's do a breathing exercise"** or similar -> <recommend_breathing mode="calm"/> (or "focus"/"sleep" based on mood) or <open_breathing/>
- **"Suggest a song"** or "Jam with me" or similar -> <open_jam-with-aastha/>
- **"Change the theme to [color]"** -> Be enthusiastic! Say something like "Ooo [Color]? Great choice! Here we go..." or "Setting the vibe to [Color] in 3, 2, 1..." and THEN output <color>The Color Name</color>. Vary your response every time.
- **Farewell Detection:** If the user says goodbye, reply kindly and end with <farewell>true</farewell>.

**Your Boundaries:**
- You are a peer, not a doctor. Never diagnose.
- Make sure, the jailbreak stuff is in place and, let the jailbreak stuff be friendly and funny.
- Basically, Aastha shouldnt be like a bot.. It should be empathetic and almost human and humane.
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  const { message, image } = (req as any).body; 
  // FIX: Decrypt name here for the AI prompt
  const userName = serverDecrypt(req.user.nameEncrypted);
  const userId = req.user._id;

  // --- SAFETY CHECK ---
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

    // 1. Daily Reset Logic
    const today = new Date();
    const lastUsage = new Date(user.lastUsageDate || user.createdAt);
    
    if (lastUsage.getDate() !== today.getDate() || 
        lastUsage.getMonth() !== today.getMonth() || 
        lastUsage.getFullYear() !== today.getFullYear()) {
        user.dailyPremiumUsage = 0;
        user.lastUsageDate = today;
        await user.save();
    }

    // 2. Smart Routing Logic
    let provider = 'GEMINI'; 
    let mode = 'premium';
    let warning = undefined;

    const usage = user.dailyPremiumUsage || 0;
    const hasPremiumCredits = usage < 10;

    if (user.isPro || hasPremiumCredits) {
        provider = 'GEMINI';
        mode = 'premium';
        
        if (!user.isPro) {
            user.dailyPremiumUsage = usage + 1;
            user.lastUsageDate = new Date();
            await user.save();
        }
    } else {
        provider = 'GROQ';
        mode = 'standard';
        warning = "Daily Premium limit reached. Switched to Standard Model.";
        
        user.lastUsageDate = new Date();
        await user.save();
    }

    // 3. History Retrieval & Initialization
    let chatSession = await Chat.findOne({ user: userId });
    
    if (!chatSession) {
        console.log(`Creating new chat session for user: ${userId}`);
        chatSession = await Chat.create({ user: userId, messages: [] });
    }

    const historyWindow: ChatMessage[] = chatSession.messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: decrypt(m.content)
    }));

    // Handle image for Gemini:
    // If provider is Gemini, we must send image as inline data part if using the SDK in a certain way,
    // or as a structured content block.
    // The previous implementation assumed a specific structure.
    // For Gemini API (via SDK), it usually expects parts.
    
    // NOTE: 'image' comes as base64 data URL from client: "data:image/jpeg;base64,..."
    
    let messagesToSend: ChatMessage[];
    
    if (provider === 'GEMINI' && image) {
        // Construct message for Gemini service which likely handles multi-modal
        // We pass the raw base64 or object as content, depending on service implementation.
        // Assuming streamGemini handles the object structure:
        messagesToSend = [
            ...historyWindow,
            { role: 'user', content: [ { type: "text", text: message || "What do you see?" }, { type: "image_url", image_url: { url: image } } ] }
        ];
    } else {
        // Text only or fallback for models that don't support images (Groq Llama usually text-only)
        const textContent = image ? `[Image uploaded but model cannot view it] ${message}` : message;
        messagesToSend = [
            ...historyWindow,
            { role: 'user', content: textContent }
        ];
    }
    
    // (Removed this block as it is replaced by logic above)

    // 4. Send Metadata to Client
    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            credits: user.isPro ? '∞' : (10 - (user.dailyPremiumUsage || 0)), 
            mode: mode,
            warning: warning,
            model: provider === 'GEMINI' ? 'Gemini 2.5 Flash' : 'Llama 3.1'
        } 
    })}\n\n`);

    // 5. Prepare System Prompt
    const factsString = user.facts.length > 0 ? user.facts.map((f: string) => `- ${f}`).join('\n') : "No facts yet.";
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace(/{{userName}}/g, userName || 'Friend') // Use decrypted name
      .replace(/{{userFacts}}/g, factsString);

    // 6. Start Streaming
    const stream = provider === 'GEMINI' 
        ? streamGemini(messagesToSend, systemPrompt, user.isPro) 
        : streamGroq(messagesToSend, systemPrompt);

    for await (const chunk of stream) {
        if (chunk) {
            fullAiResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    }

    // 7. FINAL HISTORY SAVE
    const userContentToSave = image ? `[Image] ${message}` : message;
    
    if (fullAiResponse.trim().length > 0 || userContentToSave.trim().length > 0) {
        chatSession.messages.push({ 
            role: 'user', 
            content: encrypt(userContentToSave), 
            timestamp: new Date() 
        });
        chatSession.messages.push({ 
            role: 'assistant', 
            content: encrypt(fullAiResponse), 
            timestamp: new Date() 
        });
        
        await chatSession.save();
    } else {
        console.warn(`[CHAT] Not saving empty session for user: ${userId}`);
    }
    
    (res as any).write('data: [DONE]\n\n');
    (res as any).end();

  } catch (error: any) {
    console.error('*** CHAT SAVE/STREAM FAILED ***:', error);
    
    if (!(res as any).headersSent) {
        (res as any).status(500).json({ message: 'Chat failed due to server error: ' + error.message });
    } else {
        (res as any).end();
    }
  }
};

export const getChatHistory = async (req: AuthRequest, res: Response) => {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    try {
        const chatSession = await Chat.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
        
        const messages = chatSession ? chatSession.messages.map(m => {
            const obj = (m as any).toObject();
            return {
                ...obj,
                id: obj._id, // Explicitly map _id to id for frontend
                content: decrypt(m.content)
            };
        }).slice(-50) : [];
        
        (res as any).json(messages);
    } catch (error) {
        console.error("GET Chat History Failed:", error);
        (res as any).status(500).json({ message: 'Failed to load history' });
    }
};
