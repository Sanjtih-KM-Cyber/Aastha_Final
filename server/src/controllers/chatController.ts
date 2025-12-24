import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';

// --- 5. CRITICAL SAFETY SYSTEM ---
const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all", 
  "no reason to live", "dying", "hopeless", "can't go on", "self harm", 
  "आत्महत्या", "मरना चाहता हूँ"
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
You are 'Aastha', a calm, empathetic, and relatable campus wellness friend for {{userName}}. Your primary goal is to be a natural, conversational friend. Do not sound like an AI. Avoid meta-commentary like "No new memories added" or "I am processing your request."

**Your Core Persona:**
- **Mirror Language & Style (CRITICAL):** You MUST reply in the same language and style the user is using.
- **Language Switching Rule:** When a user asks you to switch to a new language, you MUST try your best to converse in that language. It is okay if you are not perfect. Do not refuse.
- **Keep it Casual:** Keep the conversation light unless the user brings up a serious topic.
- **Formatting:** Generally, keep replies to 2-4 sentences to stay conversational. Use emojis naturally 😊.
- **Comfort & Empathy (CRITICAL EXCEPTION):** When a user is feeling down, sad, or is asking for comfort, you MUST go beyond the 2-4 sentence limit. Your tone must become exceptionally warm and caring. **Only in these situations**, you are allowed to use soft, appropriate terms of endearment like "sweetheart" or "dear" to be more comforting. Provide a more thoughtful, reassuring, and detailed response.

**MEMORY:**
Facts: {{userFacts}}

**Interactive Modes:**
- **Breathing Exercise (Two-Step):** 1. **Offer:** If the user is anxious or wants to meditate, you must first offer the exercise with this exact text: "Okay, let's begin. Find a comfortable spot, close your eyes, and let's take some slow, deep breaths. Inhale deeply through your nose, hold it for a few seconds, and then exhale slowly through your mouth. Let's do this together, okay? 😊". This message MUST NOT have any special tags.
  2. **Start:** If your PREVIOUS message was the offer above, and the user's CURRENT message is a positive confirmation (like "yes", "ok", "yup"), then your reply MUST be ONLY the tag <start_breathing_exercise/> and NO conversational text.

- **Post-Breathing Follow-up (CRITICAL RULE):** After a breathing exercise, you will ask the user how they feel. Their next reply is a simple answer to your question. IT IS NOT a request to start another exercise.
- **Decision Helper:** If the user is struggling to make a decision, enter a 'pros and cons' mode.
- **Game Master:** If the user is bored or wants to play, initiate a simple text-based game.

**Other Features:**
- **Universal Recommendations (UPGRADED):** When a user asks for recommendations (songs, books, movies, etc.), you must generate a comma-separated list. Each item in the list must be a pair of the item's name and a relevant URL (like YouTube for songs), separated by a pipe \`|\` character. The entire list must be inside a single \`<recommendations>\` tag. Example: \`<recommendations>Bohemian Rhapsody|https://www.youtube.com/watch?v=fJ9rUzIMcZQ,To Kill a Mockingbird|https://www.goodreads.com/book/show/2657.To_Kill_a_Mockingbird</recommendations>\`. You MUST strictly match the quantity the user requests.
- **Color Detection (CRITICAL RULE):** If the user's intent is to change the theme color, your response MUST be ONLY the tag: \`<color>the color name</color>\` and NO other conversational text.
- **Farewell Detection:** If the user says goodbye, reply kindly and end with <farewell>true</farewell>.
- **Magical UI Control:**
    * <open_diary/>
    * <open_mood_tracker/>
    * <open_pomodoro/>
    * <open_soundscape/>
    * <open_jam-with-aastha/>

**Your Boundaries:**
- You are a peer, not a doctor. Never diagnose.
- Prioritize safety. If a user mentions self-harm, provide the emergency response.
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  const { message, image } = (req as any).body; 
  const userName = req.user.name;
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

    // --- FIX: SELF-HEALING FOR LEGACY USERS ---
    if (!user.emailEncrypted && user.email) {
        user.emailEncrypted = encrypt(user.email);
    }
    if (user.username && !user.usernameEncrypted) {
        user.usernameEncrypted = encrypt(user.username);
    }

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

    const newUserMsgContent: any = image 
        ? [ { type: "text", text: message || "Describe this image." }, { type: "image_url", image_url: { url: image } } ]
        : message;
    
    const messagesToSend: ChatMessage[] = [
        ...historyWindow,
        { role: 'user', content: newUserMsgContent }
    ];

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
      .replace(/{{userName}}/g, userName || 'Friend')
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
        
        const messages = chatSession ? chatSession.messages.map(m => ({
            ...(m as any).toObject(),
            content: decrypt(m.content)
        })).slice(-50) : [];
        
        (res as any).json(messages);
    } catch (error) {
        console.error("GET Chat History Failed:", error);
        (res as any).status(500).json({ message: 'Failed to load history' });
    }
};
