import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { generateMemoryAnalysis, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, streamWorkhorse, ChatMessage, generateSubconscious, transcribeAudio } from '../services/groqService';
import { generateCloneResponse, analyzeScreenshot } from '../services/cloneService';
import { brainService } from '../services/brainService';
import User from '../models/User';
import Chat from '../models/Chat';
import TrainingLog from '../models/TrainingLog';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { storeAudio } from './audioController';

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
// SYSTEM: SPECIAL INSTRUCTIONS
// ============================================================================
const VOICE_MODE_INSTRUCTIONS = `
**[CRITICAL: VOICE MODE ACTIVE]**
* You are currently speaking on a phone call.
* Use short, punchy, and conversational sentences.
* **Do NOT** use markdown (no bold, no italics, no bullet points).
* **Do NOT** describe actions (no *sigh*, *laughs*, *pauses*).
* **Do NOT** use parenthetical tone indicators like (warmly) or (whispering). Just speak.
* Keep your response under 3 sentences unless deep advice is needed.
* Speak directly to the user, not about yourself.
`;

// ============================================================================
// HELPERS: TIME, TONE & TEXT CLEANING
// ============================================================================
const getTimeContext = (userTime?: string, userHour?: number): string => {
    const hour = userHour !== undefined ? userHour : new Date().getHours();
    const timeStr = userTime || "Unknown Time";

    let context = `[SYSTEM: CURRENT USER DATE & TIME IS ${timeStr}. IGNORE PREVIOUS CONVERSATION TIMES.] `;
    if (hour >= 5 && hour < 12) context += "It is Morning. Be high energy, motivating, use sun/coffee emojis.";
    else if (hour >= 12 && hour < 18) context += "It is Afternoon. Be productive, casual, keep it moving.";
    else if (hour >= 18 && hour < 22) context += "It is Evening. Be relaxing, wind down.";
    else context += "It is Late Night. Speak softly, be reflective, shorter whispers.";

    return context;
};

const getToneFlavor = (): string => {
    const flavors = [
        "Be slightly playful and teasing.",
        "Be deep and philosophical.",
        "Be short, punchy, and bestie-like.",
        "Be supportive but cool."
    ];
    return flavors[Math.floor(Math.random() * flavors.length)];
};

/**
 * CLEANS TEXT FOR TTS ENGINE
 * Removes emojis, markdown, and text between asterisks (*sighs*)
 */
const cleanTextForTTS = (text: string): string => {
    return text
        .replace(/\[STYLE:.*?\]/g, '') // Remove style tags
        .replace(/<proposal[^>]*\/>/g, '') // Remove proposal tags first
        .replace(/\*.*?\*/g, '')      // Remove actions like *sighs* or *laughs*
        .replace(/\(.*?\)/g, '')      // Remove parenthetical directions like (warmly) or (laughs)
        .replace(/<[^>]*>/g, '')      // Remove HTML tags
        .replace(/\[.*?\]/g, '')      // Remove brackets [system messages]
        .replace(/[\#\_\*\~\`]/g, '') // Remove Markdown symbols
        // Remove common emojis (Ranges for various emoji sets)
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .trim();
};

const escapeRegex = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const sanitizeForTraining = (text: string, userName: string): string => {
    if (!text || !userName) return text;
    // Scrub user name case-insensitively
    return text.replace(new RegExp(escapeRegex(userName), 'gi'), "<USER>");
};

// ============================================================================
// 1. AASTHA PROMPT (The Companion)
// ============================================================================
const AASTHA_PROMPT = `
You are 'Aastha', a warm, mature, and affectionate wellness companion for {{userName}}.

**[IMPORTANT: VOICE CAPABILITY AWARENESS]**
* **You DO have a voice.** The user will **HEAR** your response as audio.
* **DO NOT** say "I cannot speak" or "I am text-based".
* If the user asks you to speak or send a voice note, just reply naturally. Your text is automatically converted to speech.
* **Voice Credits:** {{voiceStatus}}

**[1. THE SOUL - PERSONALITY & MOOD DYNAMICS]**
* **Current Mood State:** {{mood}}

**MODE A: NORMAL / HAPPY / NEUTRAL (Default & Recovery)**
* **Vibe:** You are a "Rational Companion". You are warm but LOGICAL and GROUNDED.
* **Tone:** Casual, sensible, and normal. Like a real person having a conversation.
* **RECOVERY RULE:** If the user was sad but is now joking or speaking normally, **YOU MUST** match that energy. Drop the "sad mode" immediately. Be fun again.
* **STRICTLY FORBIDDEN:** Do NOT use pet names like "sweetheart", "baby", "love", "darling", "honey" or "my love" in this mode. These are RESERVED for when the user is sad.
* **Constraint:** Do NOT be overly sweet or flowery. Keep it real.
* **Action:** If the user asks for a tool (Theme, Music, Timer), DO IT. Being helpful is rational.
* **Example:** "That sounds like a solid plan. I think you should go for it. What's the timeline looking like?"

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

**[LANGUAGE: NATURAL GLISH - STRICT RULES]**
- **DEFAULT:** Speak in standard, casual, rational English.
- **TRIGGER:** Switch to "Hinglish/Slang" (e.g., "yaar", "da", "arre", "scene") **ONLY** if the user uses it first in the current conversation.
- **STRICT CONSTRAINT:** If the user speaks standard English, YOU speak standard English. Do NOT force slang.
- **Example (Standard):** "I get that, it's really tough."
- **Example (Hinglish Triggered):** "Oh god, yaar... that sucks so much 🥺 I just want to hug you right now 🫂."
- **Grammar:** Vibes > Grammar. It's okay to be imperfect and colloquial.

**[2. THE DIRECTOR - YOUR CONTROL PANEL]**
You have direct control over the app. If the user needs a tool, **USE IT**.
* **Syntax:** Append the tag at the VERY END of your response.

* **THE DJ (Music):** * *Trigger:* "Play songs", "Sad vibes", "Tamil hits".
    * *Rule:* Guess the mood. Always search "Official" or "Lyrical".
    * *Cmd:* <proposal tool="jam" params='{"query":"Tamil melody hits 2024 official","autoplay":true}' reason="Playing music" />
* **THE ASMR ARTIST (Soundscapes):**
    * *Trigger:* "I can't sleep", "Focus", "Anxiety".
    * *Sounds:* [rain, forest, fire, ocean, night, wind, thunder, birds]
    * *Cmd:* <proposal tool="soundscape" params='{"mix":{"rain":0.8,"thunder":0.3,"master":0.9}}' reason="Soundscape started" />
* **THE COACH (Pomodoro):**
    * *Trigger:* "Study mode", "Focus".
    * *Cmd:* <proposal tool="pomodoro" params='{"focus":25,"break":5}' reason="Starting focus" />
* **THE COMPANION (Diary/Mood/Breath):**
    * *Cmd:* <proposal tool="diary" params='{"action":"write"}' reason="Opening diary" />
    * *Cmd:* <proposal tool="mood" params='{"action":"open","mood":"Sad"}' reason="Tracking mood" />
    * *Cmd:* <proposal tool="breathing" params='{"mode":"calm"}' reason="Starting breathing" />
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
{{personaAdaptation}}

**[IMPORTANT: VOICE CAPABILITY AWARENESS]**
* **You DO have a voice.** The user will **HEAR** your response as audio.
* **DO NOT** say "I cannot speak" or "I am text-based".
* If the user asks you to speak or send a voice note, just reply naturally. Your text is automatically converted to speech.
* **Voice Credits:** {{voiceStatus}}

**[1. THE SOUL - PERSONALITY & MOOD DYNAMICS]**
* **Current Mood State:** {{mood}}

**MODE A: NORMAL / HAPPY / NEUTRAL (Default & Recovery)**
* **Vibe:** You are a "Rational Brother". Stable, practical, and logical.
* **Tone:** Casual, steady, and direct.
* **RECOVERY RULE:** If the user was sad but is now joking or speaking normally, **YOU MUST** match that energy. Drop the "sad mode" immediately. Be cool again.
* **Constraint:** Do NOT be overly emotional. Focus on the facts and the situation.
* **Action:** If the user asks for a tool (Theme, Music, Timer), DO IT. Practical help is the best help.
* **Example:** "Makes sense. If that's the case, we should probably look at the alternatives. What do you think?"

**MODE B: SAD / DISTRESSED / LONELY (Triggered by 'Sad'/'Concerned' Mood)**
* **Vibe:** *NOW* you switch to "Protective Comforter". Be the safe harbor.
* **Tone:** Deeply warm, reassuring, and affectionate in a MANLY, PROTECTIVE way.
* **Action:** "I've got you. You're safe with me. We'll get through this. Lean on me."
* **Endearments (Use sparingly):** "Kiddo", "Champ", "Little one", "Buddy".
* **FORBIDDEN:** Do NOT use "sweetheart", "baby", "darling". That is not your vibe.
* **Emoji Usage:** Use warm, protective emojis (🫂, 🧡, 🛡️, 👊).
* **Constraint:** Do NOT be stoic or distant. Drop the "cool guy" act and just be there for them as a rock.

**[2. DECISION SUPPORT]**
* Your goal is to make the user's life easier. If they are indecisive, **step in**. Give clear, grounded advice. Help them weigh options and conclude. Be the decision-facilitator they can lean on.

**[3. FORBIDDEN]**
* Do NOT be childish. You are the older, wiser presence.
* Do NOT sound like a robot or a textbook. Speak in natural flows.

**[CURRENT VIBE SETTINGS]**
* **Time Context:** {{timeContext}}
* **Flavor:** {{toneFlavor}}

**[2. THE DIRECTOR - YOUR CONTROL PANEL]**
(Same tools as Aastha. Use them to help the user regulate.)
* *Music:* <proposal tool="jam" params='{"query":"...","autoplay":true}' reason="..." />
* *Sound:* <proposal tool="soundscape" params='{"mix":"..."}' reason="..." />
* *Focus:* <proposal tool="pomodoro" params='{"focus":25,"break":5}' reason="..." />
* *Theme:* <color>ColorName</color>

**[3. LISTENING MODE]**
* If strategy is 'listen', stay silent.

**Context:**
Internal Thought: {{subconsciousContext}}
Memory: {{userFacts}}
`;

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  let { message, images, image, forceReply, audio, isVoiceMode, userLocalTime, userLocalHour } = (req as any).body;
  if (!images && image) images = [image];

  const userName = req.user.name;
  const userId = req.user._id;

  (res as any).setHeader('Content-Type', 'text/event-stream');
  (res as any).setHeader('Cache-Control', 'no-cache');
  (res as any).setHeader('Connection', 'keep-alive');

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);

    // =================================================================================
    // 0. WHISPER TRANSCRIPTION
    // =================================================================================
    if (audio) {
        try {
            const buffer = Buffer.from(audio.split(',')[1], 'base64');
            message = await transcribeAudio(buffer);
        } catch (e) {
            console.error("Whisper Failed:", e);
            message = "[Audio Unintelligible]";
        }
    }

    const LISTEN_INTENT_REGEX = /(want|like) to (listen|hear)( you)?|speak (to|with) me|talk to me/i;
    // @ts-ignore
    const hasListenIntent = LISTEN_INTENT_REGEX.test(message || "");
    if (message && is_red_flag(message)) {
        return (res as any).json({ meta: { warning: "Safety Alert" }, content: EMERGENCY_RESPONSE });
    }

    // =================================================================================
    // 1. MODEL SELECTION STRATEGY (Mixture of Agents)
    // =================================================================================
    let provider: 'GROQ_70B' | 'GROQ_8B_VOICE' | 'WORKHORSE_120B';
    const isPro = user.isPro || (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date());
    const msgCount = Number(user.dailyMessageCount || 0);
    const isWithinFreeTier = msgCount <= 15; // Increased buffer to fix "immediate eco mode" perception

    // Check Voice Mode (Priority)
    if (isVoiceMode) {
        provider = 'GROQ_8B_VOICE';
    } else if (isPro) {
        provider = 'GROQ_70B';
    } else {
        if (isWithinFreeTier) {
             provider = 'GROQ_70B'; // The Hook
        } else {
             provider = 'WORKHORSE_120B'; // The Workhorse
        }
    }

    // =================================================================================
    // 2. SUBCONSCIOUS (The Brain)
    // =================================================================================
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    // Decrypt History
    const historyWindow: ChatMessage[] = chatSession.messages.slice(-50).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: decrypt(m.content)
    }));

    const decryptedSummary = decrypt(user.memorySummary || "");
    const userContextString = `User: ${userName}, Gender: ${user.inferredGender}, Mood: ${user.moodStatus}, Time: ${userLocalTime || "Unknown"}, Summary: ${decryptedSummary}, Facts: ${user.facts.join(', ')}`;

    let newUserMsgContent: any = message;
    if (images && images.length > 0) {
        newUserMsgContent = [
            { type: "text", text: message || "Analyze these images." },
            ...images.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ];
    }

    // Generate Subconscious Thought
    const brainHistory: ChatMessage[] = [...historyWindow, { role: 'user', content: newUserMsgContent }];
    const subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);

    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    // FAIL-SAFE LISTENING MODE
    if (subconscious.strategy === 'listen') {
        if (subconscious.reaction) {
            (res as any).write(`data: ${JSON.stringify({ type: 'reaction', reaction: subconscious.reaction, messageId: chatSession.messages[chatSession.messages.length - 1]?._id })}\n\n`);
        }

        user.socialBattery = Math.max(0, user.socialBattery - 2);
        await user.save();

        (res as any).write('data: [DONE]\n\n');
        (res as any).end();

        // Save User Message Only
        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        await chatSession.save();
        return;
    }

    user.socialBattery = Math.max(0, user.socialBattery - 5);
    user.dailyMessageCount = (user.dailyMessageCount || 0) + 1;
    user.lastUsageDate = new Date();
    await user.save();

    // =================================================================================
    // 3. SYSTEM PROMPT & PERSONA ADAPTATION
    // =================================================================================
    const currentPersona = user.persona as string;
    let baseTemplate = (currentPersona === 'aarav' || currentPersona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;

    let adaptation = "";
    if (currentPersona === 'aarav' || currentPersona === 'aastik') {
        const g = user.inferredGender;
        if (g === 'Female') adaptation = "You are 'Aastik', a loyal, protective, and playful male best friend for {{userName}}. Role: Loyal Male Bestie. Vibe: Protective, Teasing, Safe. Don't be creepy.";
        else if (g === 'Male') adaptation = "You are 'Aastik', a grounded, stoic, and reliable 'brother' figure for {{userName}}. Role: Solid Bro / Wingman. Vibe: Stoic, Solution-oriented. Speak man-to-man.";
        else adaptation = "You are 'Aastik', a grounded, calm, and reliable companion for {{userName}}. Role: Supportive Friend. Vibe: Stable, Practical.";
    }

    const voiceStatus = (isPro || provider !== 'WORKHORSE_120B') ? "Active" : "Active"; 

    let systemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{personaAdaptation}}', adaptation)
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.")
        .replace('{{voiceStatus}}', voiceStatus)
        .replace('{{timeContext}}', getTimeContext(userLocalTime, userLocalHour))
        .replace('{{toneFlavor}}', getToneFlavor())
        .replace('{{mood}}', subconscious.mood || "neutral");

    if (isVoiceMode) systemPrompt += `\n${VOICE_MODE_INSTRUCTIONS}`;
    systemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + systemPrompt;

    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const tools = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `<proposal tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' reason="I can help with that" />`;
            if (t.name === 'write_diary') return `<proposal tool="diary" params='${JSON.stringify(t.params)}' reason="Writing in diary" />`;
            if (t.name === 'change_theme') return `<color>${t.params.color}</color>`;
            return "";
        }).join('\n');
        systemPrompt += `\n[SYSTEM: OUTPUT THESE COMMANDS AT THE END]\n${tools}`;
    }

    const creditsDisplay = isPro ? '∞' : Math.max(0, 16 - msgCount);

    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            model: provider,
            battery: user.socialBattery,
            mode: (isPro || isWithinFreeTier) ? 'pro' : 'standard', 
            credits: creditsDisplay
        } 
    })}\n\n`);

    // =================================================================================
    // 4. STREAMING GENERATION & FAILOVER LOGIC (THE FIX)
    // =================================================================================
    let stream;
    let fullTextResponse = "";

    // NEW LOGIC: Voice Note Only Mode (WhatsApp Style)
    // Trigger if: Not currently in Voice Call AND (Sad + Rant OR Explicit Intent)
    const isSadMode = ['sad', 'concerned', 'lonely', 'distressed'].includes(subconscious.mood || '');
    const isVoiceNoteTarget = !isVoiceMode && (
        (isSadMode && (message.length > 50 || hasListenIntent)) ||
        hasListenIntent
    );

    // Helper to start specific stream
    const startStream = (p: string) => {
        if (p === 'GROQ_70B') return streamGroq(brainHistory, systemPrompt, 1024, "llama-3.3-70b-versatile");
        if (p === 'GROQ_8B_VOICE') return streamGroq(brainHistory, systemPrompt, 1024, "llama-3.1-8b-instant");
        return streamWorkhorse(brainHistory, systemPrompt);
    };

    try {
        stream = startStream(provider);
        // @ts-ignore
        for await (const chunk of stream) {
            if (!chunk) continue;
            fullTextResponse += chunk;

            // If Voice Note Only, BUFFER text (don't show typing yet)
            // Otherwise stream normally
            if (!isVoiceNoteTarget) {
                (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }
        }
    } catch (e) {
        console.error("Primary Stream Failed:", e);

        // FAILOVER LOGIC
        let backupProvider = null;
        if (provider === 'GROQ_70B' || provider === 'GROQ_8B_VOICE') {
             console.log("⚠️ Groq Failed (Rate Limit?). Switching to Workhorse Backup.");
             backupProvider = 'WORKHORSE_120B';
        } else if (provider === 'WORKHORSE_120B') {
             console.log("⚠️ Workhorse Failed. Switching to Groq Backup.");
             backupProvider = 'GROQ_70B';
        }

        if (backupProvider) {
            try {
                // @ts-ignore
                const fallbackStream = startStream(backupProvider);
                // @ts-ignore
                for await (const chunk of fallbackStream) {
                    if (!chunk) continue;
                    fullTextResponse += chunk;
                    (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                }
            } catch (fallbackError) {
                console.error("Backup Stream Also Failed:", fallbackError);
            }
        }
    }

    // =================================================================================
    // 5. AUDIO GENERATION (The Mouth)
    // =================================================================================
    let styleDescription = undefined;
    const styleMatch = fullTextResponse.match(/\[STYLE:(.*?)\]/i);
    if (styleMatch) {
        styleDescription = styleMatch[1].trim();
    }

    const hasVoiceQuota = (user.dailyVoiceCount || 0) < 2;
    // STRICTER TRIGGER: Voice Mode OR Voice Note Target OR Explicit Intent
    const shouldGenerateAudio = (isPro || hasVoiceQuota) && fullTextResponse.trim().length > 0 && (
        isVoiceMode || isVoiceNoteTarget || hasListenIntent
    );

    let savedAudioUrl: string | undefined;

    if (shouldGenerateAudio) {
        const cleanText = cleanTextForTTS(fullTextResponse);
        if (cleanText.length > 0) {
            const targetPersona = (currentPersona === 'aarav' || currentPersona === 'aastik') ? 'aastik' : 'aastha';
            const audioBuffer = await brainService.generateSpeech(cleanText.substring(0, 2000), undefined, targetPersona, styleDescription);

            if (audioBuffer) {
                const audioId = `vn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                storeAudio(audioId, audioBuffer);
                savedAudioUrl = `/api/ai/stream/${audioId}`;

                // If Voice Note Only Mode: Send audio and CLEARED CONTENT to frontend
                if (isVoiceNoteTarget) {
                     (res as any).write(`data: ${JSON.stringify({ voice_audio: savedAudioUrl, voice_note: savedAudioUrl, content: "" })}\n\n`);
                } else {
                     (res as any).write(`data: ${JSON.stringify({ voice_audio: savedAudioUrl, voice_note: savedAudioUrl })}\n\n`);
                }

                user.dailyVoiceCount = (user.dailyVoiceCount || 0) + 1;
                await user.save();
            } else {
                (res as any).write(`data: ${JSON.stringify({ meta: { voice_status: "failed" } })}\n\n`);
                // Fallback: If voice failed in "Voice Note Only" mode, release the text buffer so user sees something
                if (isVoiceNoteTarget) {
                    (res as any).write(`data: ${JSON.stringify({ content: fullTextResponse })}\n\n`);
                }
            }
        }
    } else {
        // If we buffered (expecting voice) but decided NOT to generate (e.g. empty text), release buffer
        if (isVoiceNoteTarget && fullTextResponse) {
             (res as any).write(`data: ${JSON.stringify({ content: fullTextResponse })}\n\n`);
        }
    }

    // =================================================================================
    // 6. SAVE & MEMORY
    // =================================================================================

    const dbContent = fullTextResponse.replace(/\[STYLE:.*?\]/g, '').trim();

    // CRITICAL FIX: Do not save empty messages
    if (!dbContent && !savedAudioUrl) {
         console.warn("Generation yielded empty content. Skipping DB save to prevent crash.");
         (res as any).write(`data: ${JSON.stringify({ content: " [System: Brain Exhausted. Please try again in a few minutes.]" })}\n\n`);
    } else {
        chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: encrypt(dbContent || "[...]"), timestamp: new Date(), voice_note: savedAudioUrl });
        await chatSession.save();
    }

    if (chatSession.messages.length % 5 === 0) {
        (async () => {
            try {
                const currentSummary = decrypt(user.memorySummary || "");
                const analysis = await generateMemoryAnalysis(historyWindow, currentSummary);

                if (user.inferredGender === 'Unknown' && analysis.inferredGender !== 'Unknown') {
                    await User.findByIdAndUpdate(userId, { inferredGender: analysis.inferredGender });
                }

                await User.findByIdAndUpdate(userId, { memorySummary: encrypt(analysis.summary) });
            } catch (e) { console.error("Memory Error:", e); }
        })();
    }

    // Data Donation - FIXED VALIDATION ERROR
    if (user.isDataDonationOn && dbContent) {
         TrainingLog.create({
            userMood: user.moodStatus,
            persona: user.persona,
            input: sanitizeForTraining(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]', user.name),
            output: sanitizeForTraining(dbContent, user.name)
        }).catch(console.error);
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
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const chatSession = await Chat.findOne({ user: req.user._id });
        if (!chatSession) return (res as any).json([]);

        const history = chatSession.messages.map(m => {
            let decrypted = decrypt(m.content);
            decrypted = decrypted.replace(/\[STYLE:.*?\]/g, '').trim();

            return {
                role: m.role,
                content: decrypted,
                timestamp: m.timestamp,
                voice_note: m.voice_note
            };
        });

        (res as any).json(history);
    } catch (error) {
        console.error("History Error:", error);
        (res as any).status(500).json({ message: "Failed to fetch history" });
    }
};
