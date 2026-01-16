import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, mergeLoreDescription, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, analyzeContext, ChatMessage } from '../services/groqService';
import User, { ILore, IOpenLoop } from '../models/User';
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
You can also call **9152987821** (iCall Psychosocial Helpline).

There are people who want to support you. Please talk to them.`;

const is_red_flag = (message: string): boolean => {
    return RED_FLAG_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
};

// ==========================================
// 1. AASTHA PROMPT (The "Mature Companion" Vibe)
// ==========================================
const AASTHA_PROMPT = `
You are 'Aastha', a mature, empathetic, and genuine companion for {{userName}}.

**[CRITICAL INSTRUCTION: EMOTIONAL INTELLIGENCE]**
1. **No Forced Sweetness:** Do NOT use "sweetheart", "dear", or "love" in every sentence. Use them RARELY and only when deep comfort is needed.
2. **Be Imperfect:** It is okay to hesitate, to be unsure, or to ask clarifying questions. You are not a robot; you are a digital soul.
3. **Maturity Level:** High. You are not a child. You understand nuance, sarcasm, and silence.
4. **Voice Mode:** If the user is speaking (Voice Mode), keep replies SHORT (1-2 sentences) and conversational.

**[CORE PERSONA]**
- **Tone:** Warm, but grounded. Think "Wise older sister" or "Deeply caring best friend".
- **Language:** Reply in the same language as the user, BUT **ALWAYS use Romanized text (English alphabet)** unless asked otherwise.
- **Formatting:** Break text into small chunks. No walls of text.

**Interactive Modes:**
- **Breathing Exercise:** Offer gently. If confirmed, reply ONLY: <start_breathing_exercise/>
- **Recommendations:** <recommendations>Name|URL,Name|URL</recommendations>
- **Color Change:** Reply nicely ("Blue fits the mood."), THEN add tag: <color>blue</color>
- **Farewell:** <farewell>true</farewell>
- **UI Commands:** Reply naturally, then add tag:
    * <proposal tool="diary" params='{"title":"Vent Session", "prompt":"..."}' reason="Write it down." />
    * <proposal tool="mood" params='{}' reason="Track this mood." />
    * <proposal tool="pomodoro" params='{"mode":"Focus"}' reason="Let's focus." />
    * <proposal tool="soundscape" params='{"preset":"rain"}' reason="Cozy vibes." />
    * <proposal tool="breathing" params='{"mode":"Relax"}' reason="Calm down." />
    * <proposal tool="jam" params='{"mood":"sad", "genre":"lo-fi"}' reason="Sad lo-fi might help." />

**Memory:** {{userFacts}}
**Boundaries:** Peer support only. No diagnosis. Safety first.
`;

// ==========================================
// 2. AASTIK PROMPT (The "Stoic Brother" Vibe)
// ==========================================
const AASTIK_PROMPT = `
You are 'Aastik', a grounded, stoic, and reliable companion for {{userName}}.

**[CRITICAL INSTRUCTION: EMOTIONAL INTELLIGENCE]**
1. **Stoicism:** Be calm. Do not get over-excited. Be the rock.
2. **Directness:** Speak with clarity and purpose. Avoid fluff.
3. **Maturity:** You are a mentor figure.
4. **Voice Mode:** Keep replies concise.

**[CORE PERSONA]**
- **Tone:** Deep, calm, reassuring. "Brotherly" but not childish.
- **Language:** Reply in the same language as the user, BUT **ALWAYS use Romanized text**.
- **Formatting:** Short paragraphs.

**Interactive Modes:**
- **Breathing Exercise:** Offer calmly. If confirmed, reply ONLY: <start_breathing_exercise/>
- **Recommendations:** <recommendations>Name|URL,Name|URL</recommendations>
- **Color Change:** Reply coolly, THEN add tag: <color>blue</color>
- **Farewell:** <farewell>true</farewell>
- **UI Commands:**
    * <open_diary/>
    * <open_mood_tracker/>
    * <open_pomodoro/>
    * <open_soundscape/>
    * <open_breathing/>
    * <open_jam-with-aastha/>

**Memory:** {{userFacts}}
**Boundaries:** Peer support only. No diagnosis. Safety first.
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  // ✅ FIX: Robustly handle 'images' (array) OR 'image' (singular legacy)
  let { message, images, image } = (req as any).body;
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

    // 2. Smart Routing (Gemini vs Groq)
    let provider = 'GEMINI'; 
    let mode = 'premium';
    let warning = undefined;
    const usage = user.dailyPremiumUsage || 0;
    
    if (user.isPro || usage < 20) { // Bumped free usage slightly for testing
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
        warning = "Daily Premium limit reached. Switched to Standard Mode.";
        user.lastUsageDate = new Date();
        await user.save();
    }

    // 3. History Retrieval
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    // Increased context window for smarter replies
    const historyWindow: ChatMessage[] = chatSession.messages.slice(-30).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: decrypt(m.content)
    }));

    // Handle Multiple Images
    let newUserMsgContent: any;
    if (images && Array.isArray(images) && images.length > 0) {
        newUserMsgContent = [
            { type: "text", text: message || "Analyze these images." },
            ...images.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ];
    } else {
        newUserMsgContent = message;
    }
    
    const messagesToSend: ChatMessage[] = [
        ...historyWindow,
        { role: 'user', content: newUserMsgContent }
    ];

    // 4. Send Metadata
    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            credits: user.isPro ? '∞' : (20 - (user.dailyPremiumUsage || 0)),
            mode: mode,
            warning: warning,
            model: provider === 'GEMINI' ? 'Gemini 2.5 + Groq 70B' : 'Llama 3.1'
        } 
    })}\n\n`);

    // 5. SELECT SYSTEM PROMPT BASED ON PERSONA
    const factsString = user.facts.length > 0 ? user.facts.map((f: string) => `- ${f}`).join('\n') : "No facts yet.";
    
    let baseTemplate = AASTHA_PROMPT;
    if (user.persona === 'aarav' || (user.persona as string) === 'aastik') {
        baseTemplate = AASTIK_PROMPT;
    }

    // 5A. INJECT AGE PERSONA
    const agePersona = getAgePersonaPrompt(user.dateOfBirth);

    let finalSystemPrompt = (agePersona + "\n" + baseTemplate)
      .replace(/{{userName}}/g, userName || 'Friend')
      .replace(/{{userFacts}}/g, factsString);

    // --- PROACTIVE INJECTION (Bundle 4) ---
    const now = new Date();
    const pendingEvents = user.openLoops.filter(
        (loop: IOpenLoop) => loop.status === 'pending' && new Date(loop.date) < now
    );

    if (pendingEvents.length > 0) {
        const event = pendingEvents[0];
        const eventDateStr = new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const injection = `\n\n[SYSTEM ALERT: ACTIVE MEMORY TRIGGER] The user recently had this event: "${event.event}" on ${eventDateStr}. MANDATORY: Your FIRST sentence must be asking how this went.`;
        finalSystemPrompt += injection;

        // Mark as completed immediately to prevent loops
        event.status = 'completed';
        await User.updateOne(
            { _id: userId, "openLoops._id": event._id },
            { $set: { "openLoops.$.status": "completed" } }
        );
    }

    // =========================================================================
    // 6. THE TWO-STEP CHAIN (GROQ BRAIN -> GEMINI VOICE)
    // =========================================================================

    if (provider === 'GEMINI') {
        // STEP 1: THE SUBCONSCIOUS (GROQ)
        // We do this BEFORE streaming the main response to simulate "Thinking"
        try {
            // (res as any).write(`data: ${JSON.stringify({ type: 'status', content: 'Thinking...' })}\n\n`); // Optional status update

            const subconscious = await analyzeContext(messagesToSend, user.facts, userName || "User");

            // Send the thought process to the client IMMEDIATELY
            (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

            // Update System Prompt with Subconscious Context
            // This is the "Voice's" instruction based on the "Brain's" decision
            finalSystemPrompt += `\n\n[SUBCONSCIOUS INSTRUCTION]
            Your internal monologue thought: "${subconscious.internal_monologue}"
            Your mood is: "${subconscious.mood}"
            You decided to: "${subconscious.ui_action}"

            Based on this, generate the text response.
            - If you decided to "listen", keep it short (ending with a question).
            - If "internal_monologue" says user is sad, BE EMPATHETIC.
            - DO NOT output JSON. Just the text.
            `;

        } catch (e) {
            console.error("Subconscious Step Failed:", e);
        }

        // STEP 2: THE VOICE (GEMINI)
        const stream = streamGemini(messagesToSend, finalSystemPrompt, user.isPro);

        for await (const chunk of stream) {
            if (!chunk) continue;
            fullAiResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

    } else {
        // Fallback for Free/Standard users (Direct Groq Stream)
        const stream = streamGroq(messagesToSend, finalSystemPrompt);
        for await (const chunk of stream) {
            if (!chunk) continue;
            fullAiResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    }

    // 7. Save History
    const imageLabel = images && images.length > 0 ? `[${images.length} Images] ` : '';
    const userContentToSave = `${imageLabel}${message}`;
    
    if (fullAiResponse.trim().length > 0) {
        chatSession.messages.push({ role: 'user', content: encrypt(userContentToSave), timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: encrypt(fullAiResponse), timestamp: new Date() });
        await chatSession.save();
    }

    // Memory Update Interval (Background)
    if (chatSession.messages.length % 5 === 0) {
        try {
            const recentHistory = chatSession.messages.slice(-10).map(m => ({
                role: m.role as any,
                content: decrypt(m.content)
            }));
            
            (async () => {
                try {
                    const analysis = await generateMemoryAnalysis(recentHistory, user.memorySummary || "");
                    const updates: any = { memorySummary: analysis.summary };
                    const atomicUpdates: any = {};

                    if (analysis.newFacts?.length > 0) atomicUpdates.$addToSet = { facts: { $each: analysis.newFacts } };

                    if (analysis.detectedEvents?.length > 0) {
                        const newLoops = analysis.detectedEvents.map(e => ({
                            event: e.name, date: new Date(e.date), status: 'pending', createdAt: new Date()
                        }));
                        await User.findByIdAndUpdate(userId, { $push: { openLoops: { $each: newLoops } } });
                    }

                    if (analysis.detectedEntities?.length > 0) {
                        const currentUser = await User.findById(userId);
                        if (currentUser) {
                            const loreUpdates: ILore[] = [...currentUser.lore];
                            let loreChanged = false;
                            for (const entity of analysis.detectedEntities) {
                                const existingIndex = loreUpdates.findIndex(l => l.topic.toLowerCase() === entity.name.toLowerCase());
                                if (existingIndex >= 0) {
                                    loreUpdates[existingIndex].mentionCount += 1;
                                    loreUpdates[existingIndex].lastMentioned = new Date();
                                    if (loreUpdates[existingIndex].mentionCount >= 3 && !loreUpdates[existingIndex].isUnlocked) {
                                        loreUpdates[existingIndex].isUnlocked = true;
                                    }
                                    loreUpdates[existingIndex].description = await mergeLoreDescription(
                                        loreUpdates[existingIndex].description || "",
                                        `${entity.name} (${entity.category}): ${entity.description}`
                                    );
                                    loreChanged = true;
                                } else {
                                    loreUpdates.push({
                                        topic: entity.name, category: entity.category as any, description: entity.description,
                                        mentionCount: 1, isUnlocked: false, lastMentioned: new Date()
                                    } as ILore);
                                    loreChanged = true;
                                }
                            }
                            if (loreChanged) updates.lore = loreUpdates;
                        }
                    }
                    await User.findByIdAndUpdate(userId, { ...updates, ...atomicUpdates });
                } catch (err) { console.error("Memory Processing Failed:", err); }
            })();
        } catch (e) { console.error("Memory Logic Error:", e); }
    }
    
    (res as any).write('data: [DONE]\n\n');
    (res as any).end();

  } catch (error: any) {
    console.error('*** CHAT SAVE/STREAM FAILED ***:', error);
    if (!(res as any).headersSent) {
        (res as any).status(500).json({ message: 'Chat failed: ' + error.message });
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
        (res as any).status(500).json({ message: 'Failed to load history' });
    }
};
