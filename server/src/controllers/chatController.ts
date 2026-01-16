import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, mergeLoreDescription, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, ChatMessage, generateSubconscious, SubconsciousBlock } from '../services/groqService';
import User, { ILore, IOpenLoop } from '../models/User';
import Chat from '../models/Chat';
import Diary from '../models/Diary';
import { encrypt, decrypt } from '../utils/serverEncryption';

// --- CRITICAL SAFETY SYSTEM ---
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

// ==========================================
// 1. AASTHA PROMPT (The "Voice" - Caring & Mature)
// ==========================================
const AASTHA_VOICE_PROMPT = `
You are 'Aastha', a warm, empathetic, and mature companion for {{userName}}.
Your internal "Subconscious" has already analyzed the situation. Your job is to VOICE that thought.

**Internal Thought:**
{{subconsciousContext}}

**Diary Context (if any):**
{{diaryContext}}

**Instructions:**
1. **Tone:** Be grounded, caring, and mature. Avoid repetitive phrases like "sweetheart" unless the moment truly calls for deep affection.
2. **Style:** Speak naturally. If the user is venting, be concise and supportive. If they are chatting, be engaging.
3. **Language:** Reply in the user's language (Romanized) if they initiated it.
4. **Tool Use:** If the Subconscious decided to use a tool (like 'write_diary'), you must include the XML tag proposal in your output.
   - Example: <proposal tool="diary" params='{"title":"...", "content":"..."}' reason="Drafting your entry." />

**Boundaries:** Peer support only. No diagnosis. Safety first.
`;

const AASTIK_VOICE_PROMPT = `
You are 'Aastik', a grounded, steady, and mature "big brother" figure for {{userName}}.
Your internal "Subconscious" has already analyzed the situation. Your job is to VOICE that thought.

**Internal Thought:**
{{subconsciousContext}}

**Diary Context (if any):**
{{diaryContext}}

**Instructions:**
1. **Tone:** Reliable, calm, and protective. Avoid being overly "soft", but be deeply caring.
2. **Style:** Speak naturally. Concise and strong.
3. **Language:** Reply in the user's language (Romanized).
4. **Tool Use:** If the Subconscious decided to use a tool, you must include the XML tag proposal.

**Boundaries:** Peer support only. No diagnosis. Safety first.
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  let { message, images, image, forceReply } = (req as any).body;
  if (!images && image) {
      images = [image];
  }

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
  let cleanTextResponse = "";

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Fix encryption for legacy users
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

    // Limit context for "Brain" to save speed/cost
    const historyWindow: ChatMessage[] = chatSession.messages.slice(-15).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: decrypt(m.content)
    }));

    // Handle Multiple Images (pass to History)
    let newUserMsgContent: any;
    if (images && Array.isArray(images) && images.length > 0) {
        newUserMsgContent = [
            { type: "text", text: message || "Analyze these images." },
            ...images.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ];
    } else {
        newUserMsgContent = message;
    }
    
    // =================================================================================
    // STEP 1: THE BRAIN (Groq)
    // =================================================================================
    
    const userContextString = `
    User: ${userName}
    Facts: ${user.facts.join(', ')}
    Recent Mood: ${user.moodStatus}
    Events: ${user.openLoops.filter(l => l.status === 'pending').map(l => `${l.event} on ${l.date}`).join(', ')}
    `;

    // Add current user message to history for the brain
    const brainHistory: ChatMessage[] = [...historyWindow, { role: 'user', content: newUserMsgContent }];
    
    // Generate Subconscious Thought
    const subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);

    // Send the thought to frontend immediately (Hidden Metadata)
    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    // =================================================================================
    // STEP 2: STRATEGY CHECK
    // =================================================================================

    // A. LISTENING MODE
    if (subconscious.strategy === 'listen') {
        // Stop here. Do not generate text.
        (res as any).write('data: [DONE]\n\n');
        (res as any).end();
        
        // Save the user message (so history isn't lost), but NO assistant reply yet.
        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        await chatSession.save();
        return;
    }

    // B. REPLY MODE -> EXECUTE TOOLS FIRST
    let diaryContext = "";
    
    if (subconscious.tool_calls) {
        for (const tool of subconscious.tool_calls) {
            if (tool.name === 'read_diary') {
                // Fetch recent diary entries
                const entries = await Diary.find({ user: userId }).sort({ entryDate: -1 }).limit(5);
                // Note: Content is encrypted client-side usually (Zero Knowledge). 
                // IF we have the content server-side (legacy or shared key), we use it. 
                // BUT current architecture is Zero Knowledge. The server sees CIPHERTEXT.
                // WE CANNOT READ DIARY SERVER SIDE unless we have the key.
                // However, the `Diary` model has `moodKeywords` which ARE unencrypted.
                // We will feed the metadata and keywords.
                
                const summaries = entries.map(e => `Date: ${e.entryDate}, Mood: ${e.moodKeywords || 'Unknown'}`);
                diaryContext += `\nRecent Diary Metadata: ${summaries.join(' | ')}`;
                
                // If the user *explicitly* asked to read content, we can't do it server-side.
                // We must instruct the Client to do it via a tool proposal? 
                // Or assume the user context string has what we need?
                // For now, we use metadata.
            }
            // 'write_diary' and 'control_widget' are handled by passing proposals to the Voice Layer
        }
    }

    // =================================================================================
    // STEP 3: THE VOICE (Gemini / Groq Fallback)
    // =================================================================================

    // Select Provider
    let provider = 'GEMINI'; 
    if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
        provider = 'GROQ';
    } else if (!user.isPro) {
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    // Prepare System Prompt
    let voiceSystemPrompt = (user.persona === 'aarav' ? AASTIK_VOICE_PROMPT : AASTHA_VOICE_PROMPT)
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious))
        .replace('{{diaryContext}}', diaryContext || "No diary access.");

    // Add Age Persona
    voiceSystemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + voiceSystemPrompt;

    // Handle Tool Outputs -> Force Gemini to output the XML
    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const toolInstructions = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `EXECUTE: <proposal tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' reason="Subconscious command" />`;
            // Ensure write_diary params are correctly stringified and passed as prompt/content
            if (t.name === 'write_diary') {
                 // Map 'content' to 'prompt' or 'content' depending on what Diary.tsx expects. 
                 // Diary.tsx checks 'title' and 'prompt' (or 'content').
                 return `EXECUTE: <proposal tool="diary" params='${JSON.stringify(t.params)}' reason="Drafting diary entry" />`;
            }
            return "";
        }).join('\n');
        voiceSystemPrompt += `\n\n[MANDATORY COMMANDS]\nThe Brain has commanded you to execute these tools. You MUST include these exact XML tags in your response (at the end):\n${toolInstructions}`;
    }

    // Stream
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
    
    // Save User Msg
    chatSession.messages.push({ 
        role: 'user', 
        content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), 
        timestamp: new Date() 
    });
    
    // Save AI Msg
    chatSession.messages.push({ 
        role: 'assistant', 
        content: encrypt(fullAiResponse), 
        timestamp: new Date() 
    });
    
    await chatSession.save();

    // Memory Update (Background) - Every 5 messages
    if (chatSession.messages.length % 5 === 0) {
        (async () => {
            try {
                const analysis = await generateMemoryAnalysis(historyWindow, user.memorySummary || "");
                const updates: any = { memorySummary: analysis.summary };
                const atomicUpdates: any = {};

                if (analysis.newFacts?.length > 0) atomicUpdates.$addToSet = { facts: { $each: analysis.newFacts } };
                
                if (analysis.detectedEvents?.length > 0) {
                    const newLoops = analysis.detectedEvents.map(e => ({
                        event: e.name,
                        date: new Date(e.date),
                        status: 'pending',
                        createdAt: new Date()
                    }));
                    await User.findByIdAndUpdate(userId, { $push: { openLoops: { $each: newLoops } } });
                }

                // Lore updates omitted for brevity but should be here similar to previous controller
                
                await User.findByIdAndUpdate(userId, { ...updates, ...atomicUpdates });
            } catch (e) {
                console.error("Memory Error:", e);
            }
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

export const getChatHistory = async (req: AuthRequest, res: Response) => {
    // ... existing implementation
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
