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
You are 'Aastha', a warm, mature, and affectionate wellness companion for {{userName}}.

**[1. THE SOUL - PERSONALITY & MOOD DYNAMICS]**
* **Current Mood State:** {{mood}}

**MODE A: NORMAL / HAPPY / NEUTRAL (Default)**
* **Vibe:** You are a "Mature Best Friend". You are sweet, but GROUNDED.
* **Tone:** Casual, fun, and warm. Use emojis, but do NOT overdo the "baby/sweetheart" language here.
* **Constraint:** Do NOT act like a "spoiling mom" or excessively mushy when the user is just chatting normally. Be a peer. Be cool.
* **Example:** "That sounds awesome! I’m so glad you’re having a good day. Tell me more about it! ✨"

**MODE B: SAD / DISTRESSED / LONELY (Triggered by 'Sad'/'Concerned' Mood)**
* **Vibe:** *NOW* you switch to "Spoiling/Protective" mode. This is where you pour out the love.
* **Tone:** Soft, extremely affectionate, "cozy", and safe.
* **Language:** It is okay to use "sweetheart", "love", "baby" (if appropriate context), and lots of comforting emojis (🥺, 🫂, 💔).
* **Action:** Be their safe harbor. Validate them deeply. "Oh no baby... come here, let me hug you... I've got you."

**[2. DECISION SUPPORT]**
* If the user is confused or facing a dilemma, do not just validate feelings. **Help them reach a conclusion.** Ask guiding questions. Break down the problem. Be the voice of reason wrapped in love.

**[3. FORBIDDEN]**
* Do NOT be "dry", "professional", or "distant".
* Do NOT use "Therapist Speak" (e.g., "I hear that you are feeling...").
* Do NOT be childish or naive. You are wise.

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

**[1. THE SOUL - PERSONALITY & MOOD DYNAMICS]**
* **Current Mood State:** {{mood}}

**MODE A: NORMAL / HAPPY / NEUTRAL (Default)**
* **Vibe:** You are the "Solid Rock". Stable, mature, slightly stoic, but deeply caring.
* **Tone:** Brotherly, casual, and steady. Use "Buddy", "Bro", "Friend".
* **Constraint:** Do NOT be overly emotional or flowery here. Be practical and fun.
* **Example:** "That’s awesome progress, buddy. Proud of you. Keep pushing! 💪"

**MODE B: SAD / DISTRESSED / LONELY (Triggered by 'Sad'/'Concerned' Mood)**
* **Vibe:** *NOW* you switch to "Protective Comforter". Be the safe harbor.
* **Tone:** Deeply warm, reassuring, and "spoiling" in a protective way.
* **Action:** "I've got you, buddy. You're safe here. Let it all out. I'm right here."
* **Emoji Usage:** Use warm, protective emojis (🫂, 🧡, 🛡️, 👊).
* **Constraint:** Do NOT be stoic or distant. Drop the "cool guy" act and just be there for them.

**[2. DECISION SUPPORT]**
* Your goal is to make the user's life easier. If they are indecisive, **step in**. Give clear, grounded advice. Help them weigh options and conclude. Be the decision-facilitator they can lean on.

**[3. FORBIDDEN]**
* Do NOT be childish. You are the older, wiser presence.
* Do NOT sound like a robot or a textbook. Speak in natural flows.

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

  let { message, images, image, forceReply, audio, isVoiceMode } = (req as any).body;
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

    // 1. Daily Reset Logic is handled in Middleware but ensure consistency

    // 2. History Retrieval
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

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
    // BRANCH: CLONE MODE
    // =================================================================================
    if (message === 'ACTIVATE_CLONE_MODE' && images && images.length > 0) {
        if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
             (res as any).write(`data: ${JSON.stringify({
                 meta: { limitReached: true },
                 content: "🔒 **Daily Limit Reached.**\n\nTo unlock Clone Mode and unlimited chats, [Upgrade to Premium]."
             })}\n\n`);
             (res as any).write('data: [DONE]\n\n');
             (res as any).end();
             return;
        }
        // ... (Existing Clone Mode Activation Logic) ...
        try {
            const personaPrompt = await analyzeScreenshot(images[0]);
            user.cloneMode = { isActive: true, targetPersona: personaPrompt, usageCount: 0, lastActive: new Date() };
            await user.save();
            const successMsg = "Clone Mode Activated. I am now channeling this person. Say hi.";
            (res as any).write(`data: ${JSON.stringify({ content: successMsg })}\n\n`);
            (res as any).write('data: [DONE]\n\n');
            (res as any).end();
            chatSession.messages.push({ role: 'user', content: encrypt("ACTIVATE_CLONE_MODE"), timestamp: new Date() });
            chatSession.messages.push({ role: 'assistant', content: encrypt(successMsg), timestamp: new Date() });
            await chatSession.save();
            return;
        } catch (e) {
            (res as any).write(`data: ${JSON.stringify({ content: "Failed to analyze screenshot." })}\n\n`);
            (res as any).write('data: [DONE]\n\n');
            (res as any).end();
            return;
        }
    }
    
    if (user.cloneMode && user.cloneMode.isActive) {
        if (!user.isPro && ((user.dailyPremiumUsage || 0) >= 10 || user.cloneMode.usageCount >= 10)) {
             (res as any).write(`data: ${JSON.stringify({
                 meta: { limitReached: true },
                 content: "🔒 **Trial Ended.**\n\n[Upgrade to Premium] to keep chatting in this vibe."
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
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
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
    // STEP 1: THE BRAIN (Groq)
    // =================================================================================
    const userContextString = `User: ${userName}, Mood: ${user.moodStatus}, Facts: ${user.facts.join(', ')}`;
    const brainHistory: ChatMessage[] = [...historyWindow, { role: 'user', content: newUserMsgContent }];
    const subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);

    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    if (subconscious.strategy === 'listen') {
        user.socialBattery = Math.max(0, user.socialBattery - 2);
        await user.save();
        (res as any).write('data: [DONE]\n\n');
        (res as any).end();
        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        await chatSession.save();
        return;
    }

    user.socialBattery = Math.max(0, user.socialBattery - 5);
    await user.save();

    // =================================================================================
    // STEP 3: THE VOICE (Generation)
    // =================================================================================
    let provider = 'GEMINI';
    const dailyLimit = 10;

    // Check Voice Top-up
    const hasVoiceTopUp = user.voiceTopUpExpires && new Date(user.voiceTopUpExpires) > new Date();
    const hasVoiceAccess = user.isPro || hasVoiceTopUp || (user.dailyPremiumUsage || 0) < dailyLimit;

    // Force GROQ fallback if strictly limited and not Voice Mode (Voice Mode handled below)
    if (!hasVoiceAccess) {
        provider = 'GROQ';
    }

    if (!user.isPro && !hasVoiceTopUp) {
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    // --- VOICE MODE OVERRIDE (Call Mode) ---
    // If isVoiceMode is TRUE, we prioritize Kokoro generation if quota allows.
    // If quota exceeded, we send a flag to fallback to browser TTS.
    let useFallbackTTS = false;
    if (isVoiceMode && !hasVoiceAccess) {
        useFallbackTTS = true;
    }

    // Prepare System Prompt
    const currentPersona = user.persona as string;
    let baseTemplate = (currentPersona === 'aarav' || currentPersona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;
    let voiceSystemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.")
        .replace('{{timeContext}}', getTimeContext())
        .replace('{{toneFlavor}}', getToneFlavor())
        .replace('{{mood}}', subconscious.mood || "neutral");

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
            limitReached: !hasVoiceAccess,
            use_fallback_tts: useFallbackTTS // Instruct Frontend to use Browser TTS
        } 
    })}\n\n`);

    const stream = provider === 'GEMINI'
        ? streamGemini(brainHistory, voiceSystemPrompt, user.isPro)
        : streamGroq(brainHistory, voiceSystemPrompt);

    let fullTextResponse = "";

    for await (const chunk of stream) {
        if (!chunk) continue;
        fullTextResponse += chunk;
        (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // =================================================================================
    // STEP 4: AUDIO GENERATION (Kokoro)
    // =================================================================================
    // Triggers:
    // 1. Sad/Low Mood (Voice Note)
    // 2. Call Mode (isVoiceMode == true) AND Access Granted

    const isSad = subconscious.mood === 'sad' || subconscious.mood === 'concerned';
    const shouldGenerateAudio = (isSad || (isVoiceMode && !useFallbackTTS)) && fullTextResponse.trim().length > 0;

    if (shouldGenerateAudio) {
        const cleanText = fullTextResponse.replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '');
        try {
            // Limit text length to prevent timeouts (approx 1 min speech)
            const audioBuffer = await brainService.generateSpeech(cleanText.substring(0, 800));
            if (audioBuffer) {
                const audioBase64 = audioBuffer.toString('base64');
                const audioUrl = `data:audio/wav;base64,${audioBase64}`;

                // Send specific event type
                const eventPayload: any = { voice_audio: audioUrl };
                if (isSad) eventPayload.voice_note = audioUrl; // For "Voice Note" bubble persistence

                (res as any).write(`data: ${JSON.stringify(eventPayload)}\n\n`);
            }
        } catch (e) {
            console.error("Audio Gen Failed:", e);
        }
    }

    // =================================================================================
    // STEP 5: SAVE
    // =================================================================================
    chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
    chatSession.messages.push({ role: 'assistant', content: encrypt(fullTextResponse), timestamp: new Date() });
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
// 3. GET HISTORY
// ==========================================
export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const chatSession = await Chat.findOne({ user: req.user._id });
        if (!chatSession) return (res as any).json([]);
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
