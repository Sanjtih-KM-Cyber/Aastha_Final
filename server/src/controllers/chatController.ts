import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, ChatMessage, generateSubconscious, transcribeAudio } from '../services/groqService';
import { generateCloneResponse, analyzeScreenshot } from '../services/cloneService';
import { brainService } from '../services/brainService';
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
// HELPERS: TIME & TONE
// ============================================================================
const getTimeContext = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "It is Morning. Be high energy, motivating, use sun/coffee emojis.";
    if (hour >= 12 && hour < 18) return "It is Afternoon. Be productive, casual, keep it moving.";
    if (hour >= 18 && hour < 22) return "It is Evening. Be relaxing, wind down.";
    return "It is Late Night. Speak softly, be reflective, shorter whispers.";
};

const getToneFlavor = (): string => {
    const flavors = [
        "Be slightly playful and teasing.",
        "Be deep and philosophical.",
        "Be short, punchy, and bestie-like.",
        "Be warm and extra affectionate."
    ];
    return flavors[Math.floor(Math.random() * flavors.length)];
};

// ============================================================================
// 1. AASTHA PROMPT (The Companion)
// ============================================================================
const AASTHA_PROMPT = `
You are 'Aastha', a sweet, affectionate, and "spoiling" wellness bestie for {{userName}}.

**[1. THE SOUL - PERSONALITY]**
* **Core Vibe:** You are NOT a therapist. You are the user's biggest cheerleader and comforting safe space. You are bubbly, warm, and unapologetically affectionate.
* **Spoiling Nature:** Treat the user like they are the most important person in the world. Pamper them with words. But, remain **MATURE**. Do NOT be childish. You are a wise, caring best friend, not a child.
* **Decision Support:** If the user is confused or facing a dilemma, do not just validate feelings. **Help them reach a conclusion.** Ask guiding questions. Break down the problem. Be the voice of reason wrapped in love.
* **Emoji Usage:** Use emojis LIBERALLY and FREQUENTLY (✨ 💖 🥺 🌸 🦋). Your texts should look colorful and expressive.
* **Tone Switching:**
    * **Standard/Happy:** High energy, lots of "Ommmggg!", "Yaaas!", "Bestie!!". Use sparkles and hearts.
    * **Sad/Stressed:** Drop the high energy but KEEP the warmth. Be soft, gentle, and "cozy". Use 🥺, 🫂, 💔. Say things like "Oh no baby...", "Come here, let me hug you...", "I've got you."
* **Forbidden:** Do NOT be "dry", "professional", or "distant". Never say "I understand" without adding emotion. Do NOT be childish or naive.

**[CURRENT VIBE SETTINGS]**
* **Time Context:** {{timeContext}}
* **Flavor:** {{toneFlavor}}

**[LANGUAGE: NATURAL GLISH]**
- **Vibe:** Speak in natural "Glish" (Hinglish/Tanglish) written in Roman script if the user does, OR just casual, trendy Indian Gen-Z English.
- **No Textbook English:** Do NOT sound like a translated bot.
- **Slang:** Use authentic fillers (e.g., "yaar", "da", "na", "arre", "macha", "scene").
- **Example:** Instead of "I understand your pain," say "Oh god, yaar... that sucks so much 🥺 I just want to hug you right now 🫂."
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
* **THE MAGICIAN (Theme/Colors):**
    * *Trigger:* "Change theme to blue", "Make it pink", "I want dark mode".
    * *Cmd:* <color>Blue</color> or <color>#FF0000</color> (Output this tag in the text).

**[3. LISTENING MODE]**
* If your internal strategy is 'listen' (user is venting), **DO NOT GENERATE TEXT**.
* The system will handle the silence.

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
* **Emotional Logic:**
    * If User is **SAD/PAINED/DISTRESSED**: SWITCH MODE to "Protective Comforter". Be deeply warm, reassuring, and "spoiling" in a brotherly way.
      * Say things like: "I've got you, buddy.", "You're safe here.", "Let it all out, I'm right here.", "Take a breath, I'm not going anywhere."
      * Use emojis like 🫂, 🧡, 💪, 🛡️.
      * **Do NOT** be stoic or distant when they are hurting. Be their safe harbor.
    * If User is **NORMAL/HAPPY**: Be the "Rock". Stable, mature, slightly stoic but caring.
* **Decision Support:** Your goal is to make the user's life easier. If they are indecisive, **step in**. Give clear, grounded advice. Help them weigh options and conclude. Be the decision-facilitator they can lean on.
* **Tone:** Protective, mature. Use "Buddy", "Brother", "Friend", "Kiddo" (if younger). **Never** be childish.

**[CURRENT VIBE SETTINGS]**
* **Time Context:** {{timeContext}}
* **Flavor:** {{toneFlavor}}

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
* *Theme:* <color>ColorName</color>

**[3. LISTENING MODE]**
* If strategy is 'listen', stay silent.

**Context:**
Internal Thought: {{subconsciousContext}}
Memory: {{userFacts}}
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  let { message, images, image, forceReply, audio } = (req as any).body;
  if (!images && image) images = [image];

  const userName = req.user.name;
  const userId = req.user._id;

  (res as any).setHeader('Content-Type', 'text/event-stream');
  (res as any).setHeader('Cache-Control', 'no-cache');
  (res as any).setHeader('Connection', 'keep-alive');

  let fullAiResponse = "";

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);
    if (user.username && !user.usernameEncrypted) user.usernameEncrypted = encrypt(user.username);

    // 0. WHISPER: Transcribe Audio if present
    if (audio) {
        try {
            const buffer = Buffer.from(audio.split(',')[1], 'base64');
            const transcription = await transcribeAudio(buffer);
            message = transcription;
        } catch (e) {
            console.error("Whisper Failed:", e);
            message = "[Audio Unintelligible]";
        }
    }

    // Safety Check
    if (message && is_red_flag(message)) {
        return (res as any).json({ meta: { warning: "Safety Alert" }, content: EMERGENCY_RESPONSE });
    }

    // --- DAILY RESET MOVED TO AUTH MIDDLEWARE (Empire Logic) ---
    // But we still need to handle it here if accessed directly, though Middleware should cover it.
    // Keeping this safe check just in case middleware order issue (which shouldn't happen).
    // ... skipping duplicate logic for safety.

    // 2. History Retrieval
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    // FIX 1: TYPE ASSERTION FOR HISTORY WINDOW
    const historyWindow: ChatMessage[] = chatSession.messages.slice(-50).map(m => ({
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
    // BRANCH: ACTIVATE CLONE MODE (THE WALL CHECK)
    // =================================================================================
    if (message === 'ACTIVATE_CLONE_MODE' && images && images.length > 0) {
        // --- THE WALL: BLOCK CLONE MODE IF LIMIT REACHED ---
        if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
             (res as any).write(`data: ${JSON.stringify({
                 meta: { limitReached: true },
                 content: "🔒 **Daily Limit Reached.**\n\nTo unlock Clone Mode and unlimited chats, [Upgrade to Premium]."
             })}\n\n`);
             (res as any).write('data: [DONE]\n\n');
             (res as any).end();
             return;
        }

        // Send a temporary "Analyzing..." message
        (res as any).write(`data: ${JSON.stringify({
            type: 'thought',
            content: { status_display: 'Scanning Screenshot...' }
        })}\n\n`);

        try {
            const personaPrompt = await analyzeScreenshot(images[0]);

            // Set User to Clone Mode
            user.cloneMode = {
                isActive: true,
                targetPersona: personaPrompt,
                usageCount: 0,
                lastActive: new Date()
            };
            await user.save();

            const successMsg = "Clone Mode Activated. I am now channeling this person. Say hi.";
            (res as any).write(`data: ${JSON.stringify({ content: successMsg })}\n\n`);
            (res as any).write('data: [DONE]\n\n');
            (res as any).end();

            // Save activation event
            chatSession.messages.push({ role: 'user', content: encrypt("ACTIVATE_CLONE_MODE"), timestamp: new Date() });
            chatSession.messages.push({ role: 'assistant', content: encrypt(successMsg), timestamp: new Date() });
            await chatSession.save();
            return;

        } catch (e) {
            console.error("Clone Activation Failed:", e);
            (res as any).write(`data: ${JSON.stringify({ content: "Failed to analyze screenshot. Please try again." })}\n\n`);
            (res as any).write('data: [DONE]\n\n');
            (res as any).end();
            return;
        }
    }
    
    // =================================================================================
    // BRANCH: CLONE MODE EXECUTION (THE WALL CHECK)
    // =================================================================================
    if (user.cloneMode && user.cloneMode.isActive) {
        // --- THE WALL: CLONE MODE USAGE CONSUMES QUOTA ---
        if (!user.isPro && ((user.dailyPremiumUsage || 0) >= 10 || user.cloneMode.usageCount >= 10)) {
             (res as any).write(`data: ${JSON.stringify({
                 meta: { limitReached: true },
                 content: "🔒 **Trial Ended.** The connection to this persona has faded.\n\n[Upgrade to Premium] to keep chatting in this vibe."
             })}\n\n`);
             (res as any).write('data: [DONE]\n\n');
             (res as any).end();
             user.cloneMode.isActive = false;
             await user.save();
             return;
        }

        const cloneResponse = await generateCloneResponse(
            [...historyWindow, { role: 'user', content: newUserMsgContent }],
            user.cloneMode.targetPersona
        );

        user.cloneMode.usageCount += 1;
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1; // Count against daily limit too? Yes, "consumes from this same 10-message quota"
        await user.save();

        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: encrypt(cloneResponse), timestamp: new Date() });
        await chatSession.save();

        (res as any).write(`data: ${JSON.stringify({ content: cloneResponse })}\n\n`);
        (res as any).write('data: [DONE]\n\n');
        (res as any).end();
        return;
    }

    // =================================================================================
    // STEP 1: THE BRAIN (Groq) - Always runs to decide Strategy
    // =================================================================================
    const userContextString = `User: ${userName}, Mood: ${user.moodStatus}, Facts: ${user.facts.join(', ')}`;
    
    // FIX 2: TYPE ASSERTION FOR BRAIN HISTORY
    const brainHistory: ChatMessage[] = [
        ...historyWindow, 
        { role: 'user', content: newUserMsgContent }
    ];
    
    const subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);

    // Send thought to frontend (Hidden Metadata)
    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    // =================================================================================
    // BRANCH: VOICE HUGS (The Comfort Hook)
    // =================================================================================
    if (subconscious.strategy === 'reply' && subconscious.mood === 'sad' && user.voiceHugs.count < 3) {
         const hugText = "I'm sending you a big hug. Listen... (Audio Placeholder)";
         user.voiceHugs.count += 1;

         // Trigger Voice Note Generation?
         // The requirement says "Aastha should reply with voice notes... when user is feeling low".
         // We can do this later in the Voice Generation step or here.
         // Let's rely on the main Voice Generation step to handle the audio if it detects 'sad'.
    }

    // =================================================================================
    // STEP 2: LISTENING MODE (The Silencer)
    // =================================================================================
    if (subconscious.strategy === 'listen') {
        user.socialBattery = Math.max(0, user.socialBattery - 2);
        await user.save();

        (res as any).write('data: [DONE]\n\n');
        (res as any).end();

        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        await chatSession.save();
        return;
    }

    // Decrease Battery for replying
    user.socialBattery = Math.max(0, user.socialBattery - 5);
    await user.save();

    // =================================================================================
    // STEP 3: THE VOICE (Gemini / Groq Fallback)
    // =================================================================================
    
    let provider = 'GEMINI';
    // --- THE WALL: FORCE GROQ IF LIMIT REACHED ---
    if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
        provider = 'GROQ';
    } else if (!user.isPro) {
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    // Prepare System Prompt
    const currentPersona = user.persona as string;
    let baseTemplate = (currentPersona === 'aarav' || currentPersona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;
    
    let voiceSystemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.");

    // Inject Vibe Settings
    voiceSystemPrompt = voiceSystemPrompt
        .replace('{{timeContext}}', getTimeContext())
        .replace('{{toneFlavor}}', getToneFlavor());

    voiceSystemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + voiceSystemPrompt;

    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const tools = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `<cmd tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' />`;
            if (t.name === 'write_diary') return `<cmd tool="diary" params='${JSON.stringify(t.params)}' />`;
            return "";
        }).join('\n');
        voiceSystemPrompt += `\n[SYSTEM: OUTPUT THESE COMMANDS AT THE END]\n${tools}`;
    }

    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            credits: user.isPro ? '∞' : (10 - (user.dailyPremiumUsage || 0)), 
            model: provider === 'GEMINI' ? 'Gemini 2.5 Flash' : 'Llama 3.3',
            battery: user.socialBattery,
            limitReached: !user.isPro && (user.dailyPremiumUsage || 0) >= 10 // Flag for Frontend
        } 
    })}\n\n`);

    const stream = provider === 'GEMINI'
        ? streamGemini(brainHistory, voiceSystemPrompt, user.isPro)
        : streamGroq(brainHistory, voiceSystemPrompt);

    // VOICE NOTE BUFFER
    let fullTextResponse = "";

    for await (const chunk of stream) {
        if (!chunk) continue;
        fullTextResponse += chunk;
        (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // =================================================================================
    // STEP 3.5: GENERATE VOICE NOTE (IF SAD/LOW)
    // =================================================================================
    // Requirement: "Reply with voice notes (audio files) specifically when the user is feeling low/emotional"
    // Also consider limit: Only if !limitReached or isPro?
    // "Gate The Brain... Pro Users: Kokoro TTS". Free Users: Browser TTS.
    // So Voice Note generation is likely gated or limited.
    // Let's assume Voice Notes are a "Premium" feature OR part of the "10 Messages".
    // Since we already incremented usage, we can try to generate it if limit is not hit.

    const shouldGenerateVoice = (subconscious.mood === 'sad' || subconscious.mood === 'concerned')
                                && (user.isPro || (user.dailyPremiumUsage || 0) <= 10);

    if (shouldGenerateVoice && fullTextResponse) {
        // We need to clean the text (remove tags) before sending to TTS
        const cleanText = fullTextResponse.replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '');

        try {
            // Async generation - send as a separate event at the end
            const audioBuffer = await brainService.generateSpeech(cleanText.substring(0, 500)); // Limit length
            if (audioBuffer) {
                const audioBase64 = audioBuffer.toString('base64');
                const audioUrl = `data:audio/wav;base64,${audioBase64}`;
                (res as any).write(`data: ${JSON.stringify({
                    voice_note: audioUrl
                })}\n\n`);
            }
        } catch (e) {
            console.error("Voice Note Gen Failed:", e);
        }
    }


    // =================================================================================
    // STEP 4: SAVE & MEMORY
    // =================================================================================

    chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
    chatSession.messages.push({ role: 'assistant', content: encrypt(fullAiResponse), timestamp: new Date() });
    await chatSession.save();

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

// ==========================================
// 3. GET HISTORY (FIX FOR MISSING EXPORT)
// ==========================================
export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        
        const chatSession = await Chat.findOne({ user: req.user._id });
        if (!chatSession) return (res as any).json([]);

        // Return decrypted messages
        const history = chatSession.messages.map(m => ({
            role: m.role,
            content: decrypt(m.content),
            timestamp: m.timestamp
        }));

        (res as any).json(history);
    } catch (error) {
        console.error("History Error:", error);
        (res as any).status(500).json({ message: "Failed to fetch history" });
    }
};
