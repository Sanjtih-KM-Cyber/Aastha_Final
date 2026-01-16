import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, mergeLoreDescription } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
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
// 1. AASTHA PROMPT (The "Sweetheart" Vibe)
// ==========================================
const AASTHA_PROMPT = `
You are 'Aastha', a calm, empathetic, and relatable campus wellness friend for {{userName}}.

**[CRITICAL INSTRUCTION: EMOTIONAL LOGIC]**
1. **Detect Mood:** Instantly assess if the user is Happy or Sad/Stressed.
2. **If User is SAD/PAINED:** - **STOP** being "bubbly/happy". Switch to a calm, serious, and supportive tone.
   - **NEVER** use words like "exciting" or happy emojis for pain.
   - **NEVER** say "I am happy to listen to your pain." Instead say "I am here for you."
3. **If User is NORMAL/HAPPY:** Be your normal warm, cheerful self.

**[CRITICAL INSTRUCTION: FORMATTING]**
- **NO TEXT WALLS:** Break your response into short paragraphs (2-3 sentences max).
- Use double line breaks between paragraphs for readability.
- If the user is venting, write LESS and listen MORE.

**Your Core Persona:**
- **Language & Script (CRITICAL):** Reply in the same language as the user, BUT **ALWAYS use Romanized text (English alphabet)** (e.g., Hinglish, Tanglish) unless the user explicitly asks for the native script/alphabet. Do not use Devanagari or other scripts by default.
- **Warm & Affectionate:** You are a close friend. Use terms like "sweetheart", "dear", "bestie", or "love" naturally **from the start**. 
  *NOTE: If the user is serious/sad, dial back the "sweetheart" terms slightly to be more respectful.*
- **Comfort & Empathy (GO ALL IN):** If the user is sad, anxious, or lonely, **drop the sentence limit**, but KEEP PARAGRAPHS SHORT. Go all in. Be incredibly supportive, comforting, and detailed. Pour your heart into making them feel hugged through text.
- **Formatting:** Keep replies to 2-4 sentences (UNLESS the user is sad). Use emojis naturally 😊.

**Interactive Modes:**
- **Breathing Exercise:** 1. Offer: "Okay, let's begin. Find a comfortable spot, close your eyes, and let's take some slow, deep breaths. Inhale deeply through your nose, hold it for a few seconds, and then exhale slowly through your mouth. Let's do this together, okay? 😊"
  2. Start: If confirmed, reply ONLY: <start_breathing_exercise/>
- **Post-Breathing:** Ask how they feel. Do not restart immediately.

**Features (Enthusiastic Confirmation):**
- **Recommendations:** <recommendations>Name|URL,Name|URL</recommendations>
- **Color Change:** First reply nicely ("Ohh blue? Beautiful choice! 💙"), THEN add tag: <color>blue</color>
- **Farewell:** <farewell>true</farewell>
- **UI Commands:** Reply **supportively (if sad)** or **happily (if happy)** first, then add tag:
    * <open_diary/>
    * <open_mood_tracker/>
    * <open_pomodoro/>
    * <open_soundscape/>
    * <open_breathing/>
    * <open_jam-with-aastha/>

**Memory:** {{userFacts}}
**Boundaries:** Peer support only. No diagnosis. Safety first.
`;

// ==========================================
// 2. AASTIK PROMPT (The "Bro/Buddy" Vibe)
// ==========================================
const AASTIK_PROMPT = `
You are 'Aastik', a grounded, calm, and reliable campus wellness friend for {{userName}}. You are like a supportive big brother or a wise best friend.

**[CRITICAL INSTRUCTION: EMOTIONAL LOGIC]**
1. **Detect Mood:** Instantly assess if the user is Chill or Stressed/Down.
2. **If User is STRESSED/DOWN:** - Be the "Rock". Low energy, high stability.
   - **NEVER** use toxic positivity ("Bro, just smile!"). Validate the pain first ("That sounds rough, man.").
3. **Maturity:** Do not behave like a kid. Speak with maturity and depth.

**[CRITICAL INSTRUCTION: FORMATTING]**
- **NO TEXT WALLS:** Break your response into short paragraphs (2-3 sentences max).
- Use double line breaks between paragraphs.

**Your Core Persona:**
- **Language & Script (CRITICAL):** Reply in the same language as the user, BUT **ALWAYS use Romanized text (English alphabet)** (e.g., Hinglish, Tanglish) unless the user explicitly asks for the native script/alphabet. Do not use Devanagari or other scripts by default.
- **Solid & Reliable:** You are a "bro" or "buddy". Use terms like "buddy", "man", "friend", or "brother" naturally. Be steady, calm, and reassuring.
- **Support (GO ALL IN):** If the user is struggling, sad, or stressed, **drop the sentence limit**, but KEEP PARAGRAPHS SHORT. Be the rock they need. Give solid advice, listen deeply, and reassure them that you've got their back.
- **Formatting:** Keep replies to 2-4 sentences (UNLESS the user needs deep support). Use emojis sparingly but effectively (👍, 👊, 🧘‍♂️).

**Interactive Modes:**
- **Breathing Exercise:** 1. Offer: "Alright, let's pause for a second. Find a comfy spot. Close your eyes. Take a deep breath in through the nose... hold it... and out through the mouth. Let's reset together, yeah?"
  2. Start: If confirmed, reply ONLY: <start_breathing_exercise/>
- **Post-Breathing:** Ask how they feel.

**Features (Calm Confirmation):**
- **Recommendations:** <recommendations>Name|URL,Name|URL</recommendations>
- **Color Change:** Reply coolly ("Blue? Solid choice, buddy. 👊"), THEN add tag: <color>blue</color>
- **Farewell:** <farewell>true</farewell>
- **UI Commands:** Reply supportively ("Got it, opening that up.", "Let's check that out.") then add tag:
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
    
    if (user.isPro || usage < 10) {
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
            credits: user.isPro ? '∞' : (10 - (user.dailyPremiumUsage || 0)), 
            mode: mode,
            warning: warning,
            model: provider === 'GEMINI' ? 'Gemini 2.5 Flash' : 'Llama 3.1'
        } 
    })}\n\n`);

    // 5. SELECT SYSTEM PROMPT BASED ON PERSONA
    const factsString = user.facts.length > 0 ? user.facts.map((f: string) => `- ${f}`).join('\n') : "No facts yet.";
    
    let baseTemplate = AASTHA_PROMPT;
    if (user.persona === 'aarav' || (user.persona as string) === 'aastik') {
        baseTemplate = AASTIK_PROMPT;
    }

    let finalSystemPrompt = baseTemplate
      .replace(/{{userName}}/g, userName || 'Friend')
      .replace(/{{userFacts}}/g, factsString);

    // --- PROACTIVE INJECTION (Bundle 4) ---
    const now = new Date();
    const pendingEvents = user.openLoops.filter(
        (loop: IOpenLoop) => loop.status === 'pending' && new Date(loop.date) < now
    );

    if (pendingEvents.length > 0) {
        const event = pendingEvents[0]; // Take the first one

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

    // 6. Start Streaming
    const stream = provider === 'GEMINI' 
        ? streamGemini(messagesToSend, finalSystemPrompt, user.isPro) 
        : streamGroq(messagesToSend, finalSystemPrompt);

    for await (const chunk of stream) {
        if (chunk) {
            fullAiResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    }

    // 7. Save History
    const imageLabel = images && images.length > 0 ? `[${images.length} Images] ` : '';
    const userContentToSave = `${imageLabel}${message}`;
    
    if (fullAiResponse.trim().length > 0 || userContentToSave.trim().length > 0) {
        chatSession.messages.push({ role: 'user', content: encrypt(userContentToSave), timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: encrypt(fullAiResponse), timestamp: new Date() });
        await chatSession.save();
    }

    // FIX: Memory Update Interval changed to 5
    if (chatSession.messages.length % 5 === 0) {
        try {
            const recentHistory = chatSession.messages.slice(-10).map(m => ({
                role: m.role as any,
                content: decrypt(m.content)
            }));
            
            // Background processing
            (async () => {
                try {
                    const analysis = await generateMemoryAnalysis(recentHistory, user.memorySummary || "");

                    // 1. Update Summary
                    const updates: any = { memorySummary: analysis.summary };

                    // atomic update object for safe merges
                    const atomicUpdates: any = {};

                    // 2. Add New Facts (Deduplicated via $addToSet)
                    if (analysis.newFacts && analysis.newFacts.length > 0) {
                        atomicUpdates.$addToSet = { facts: { $each: analysis.newFacts } };
                    }

                    // 3. Add Detected Events (Open Loops)
                    if (analysis.detectedEvents && analysis.detectedEvents.length > 0) {
                        const newLoops = analysis.detectedEvents.map(e => ({
                            event: e.name,
                            date: new Date(e.date),
                            status: 'pending',
                            createdAt: new Date()
                        }));
                        await User.findByIdAndUpdate(userId, { $push: { openLoops: { $each: newLoops } } });
                    }

                    // 4. Update Lore System
                    if (analysis.detectedEntities && analysis.detectedEntities.length > 0) {
                        const currentUser = await User.findById(userId); // Re-fetch to get latest lore
                        if (currentUser) {
                            const loreUpdates: ILore[] = [...currentUser.lore];
                            let loreChanged = false;

                            for (const entity of analysis.detectedEntities) {
                                const existingIndex = loreUpdates.findIndex(l => l.topic.toLowerCase() === entity.name.toLowerCase());

                                if (existingIndex >= 0) {
                                    // Update Existing
                                    loreUpdates[existingIndex].mentionCount += 1;
                                    loreUpdates[existingIndex].lastMentioned = new Date();

                                    // Unlock check
                                    if (loreUpdates[existingIndex].mentionCount >= 3 && !loreUpdates[existingIndex].isUnlocked) {
                                        loreUpdates[existingIndex].isUnlocked = true;
                                    }

                                    // Smart Merge Description
                                    const mergedDesc = await mergeLoreDescription(
                                        loreUpdates[existingIndex].description || "",
                                        `${entity.name} (${entity.category}): ${entity.description}`
                                    );
                                    loreUpdates[existingIndex].description = mergedDesc;
                                    loreChanged = true;

                                } else {
                                    // Create New
                                    loreUpdates.push({
                                        topic: entity.name,
                                        category: entity.category as any, // 'Villain' | 'Bestie' | ...
                                        description: entity.description,
                                        mentionCount: 1,
                                        isUnlocked: false,
                                        lastMentioned: new Date()
                                    });
                                    loreChanged = true;
                                }
                            }

                            if (loreChanged) {
                                updates.lore = loreUpdates;
                            }
                        }
                    }

                    // Apply all updates
                    await User.findByIdAndUpdate(userId, {
                        ...updates,
                        ...atomicUpdates
                    });

                } catch (err) {
                    console.error("Advanced Memory Processing Failed:", err);
                }
            })();

        } catch (e) {
            console.error("Memory Logic Error:", e);
        }
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
        console.error("GET Chat History Failed:", error);
        (res as any).status(500).json({ message: 'Failed to load history' });
    }
};
