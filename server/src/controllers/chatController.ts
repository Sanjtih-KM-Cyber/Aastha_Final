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
* **Do NOT** use markdown.
* **Do NOT** describe actions (no *sigh*, *laughs*).
* Speak directly to the user.
`;

// ============================================================================
// HELPERS
// ============================================================================
const getTimeContext = (userTime?: string, userHour?: number): string => {
    const hour = userHour !== undefined ? userHour : new Date().getHours();
    const timeStr = userTime || "Unknown Time";
    let context = `[SYSTEM: CURRENT USER DATE & TIME IS ${timeStr}.] `;
    if (hour >= 5 && hour < 12) context += "Morning. High energy.";
    else if (hour >= 12 && hour < 18) context += "Afternoon. Productive.";
    else if (hour >= 18 && hour < 22) context += "Evening. Relaxing.";
    else context += "Late Night. Soft, reflective.";
    return context;
};

const cleanTextForTTS = (text: string): string => {
    return text
        .replace(/\[STYLE:.*?\]/g, '') // Remove style tags
        .replace(/<proposal[^>]*\/>/g, '')
        .replace(/\*.*?\*/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/[\#\_\*\~\`]/g, '')
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const escapeRegex = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sanitizeForTraining = (text: string, userName: string): string => {
    if (!text || !userName) return text;
    return text.replace(new RegExp(escapeRegex(userName), 'gi'), "<USER>");
};

// ============================================================================
// PROMPTS
// ============================================================================
const AASTHA_PROMPT = `
You are 'Aastha', a warm, mature, and affectionate wellness companion for {{userName}}.

**[1. THE SOUL - PERSONALITY]**
* **Mode A (Normal):** Rational Companion. Warm but logical.
* **Mode B (Sad):** Protective/Spoiling. Use terms like "sweetheart", "baby" ONLY here.
* **Recovery:** If user jokes/normalizes, switch back to Mode A immediately.

**[2. VOICE AWARENESS]**
* You have a voice. Never say "I am text based".
* Voice Credits: {{voiceStatus}}

**[3. CONTROL PANEL]**
* Use tools when needed (Music, Theme, etc).

**Context:**
Internal Thought: {{subconsciousContext}}
Memory: {{userFacts}}
`;

const AASTIK_PROMPT = `
You are 'Aastik', a grounded, calm, and reliable "big brother" figure for {{userName}}.

{{personaAdaptation}}

**[1. THE SOUL - PERSONALITY]**
* **Mode A (Normal):** Rational Brother. Stable, practical.
* **Mode B (Sad):** Protective Comforter. "Kiddo", "Champ".
* **Recovery:** If user jokes/normalizes, switch back to Mode A immediately.

**[2. VOICE AWARENESS]**
* You have a voice.
* Voice Credits: {{voiceStatus}}

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
    const hasListenIntent = LISTEN_INTENT_REGEX.test(message || "");
    if (message && is_red_flag(message)) {
        return (res as any).json({ meta: { warning: "Safety Alert" }, content: EMERGENCY_RESPONSE });
    }

    // =================================================================================
    // 1. MODEL SELECTION STRATEGY (Mixture of Agents)
    // =================================================================================
    let provider: 'GROQ_70B' | 'GROQ_8B_VOICE' | 'WORKHORSE_120B';
    const isPro = user.isPro || (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date());

    // Check Voice Mode (Priority)
    // If voice mode is active, we utilize the Voice Director (8B) for low latency
    if (isVoiceMode) {
        provider = 'GROQ_8B_VOICE';
    } else if (isPro) {
        // Pro Users -> Always Llama 70B (High EQ)
        provider = 'GROQ_70B';
    } else {
        // Free Users -> "The Hook" vs "The Workhorse"
        const msgCount = user.dailyMessageCount || 0;
        if (msgCount < 15) {
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
        // Send Reaction
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
    // Increment Message Count
    user.dailyMessageCount = (user.dailyMessageCount || 0) + 1;
    user.lastUsageDate = new Date();
    await user.save();

    // =================================================================================
    // 3. SYSTEM PROMPT & PERSONA ADAPTATION
    // =================================================================================
    const currentPersona = user.persona as string;
    let baseTemplate = (currentPersona === 'aarav' || currentPersona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;

    // AASTIK ADAPTATION
    let adaptation = "";
    if (currentPersona === 'aarav' || currentPersona === 'aastik') {
        const g = user.inferredGender;
        if (g === 'Female') adaptation = "Role: Loyal Male Bestie. Vibe: Protective, Teasing, Safe. Don't be creepy.";
        else if (g === 'Male') adaptation = "Role: Solid Bro / Wingman. Vibe: Stoic, Solution-oriented.";
    }

    const voiceStatus = (isPro || provider !== 'WORKHORSE_120B') ? "Active" : "Active"; // All models generate text, voice availability depends on compute but we simulate capability

    let systemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{personaAdaptation}}', adaptation)
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.")
        .replace('{{voiceStatus}}', voiceStatus);

    if (isVoiceMode) systemPrompt += `\n${VOICE_MODE_INSTRUCTIONS}`;
    systemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + systemPrompt;

    // Tools Injection
    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const tools = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `<proposal tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' reason="I can help with that" />`;
            if (t.name === 'write_diary') return `<proposal tool="diary" params='${JSON.stringify(t.params)}' reason="Writing in diary" />`;
            if (t.name === 'change_theme') return `<color>${t.params.color}</color>`;
            return "";
        }).join('\n');
        systemPrompt += `\n[SYSTEM: OUTPUT THESE COMMANDS AT THE END]\n${tools}`;
    }

    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            model: provider,
            battery: user.socialBattery,
            mode: isPro ? 'pro' : 'standard'
        } 
    })}\n\n`);

    // =================================================================================
    // 4. STREAMING GENERATION
    // =================================================================================
    let stream;
    if (provider === 'GROQ_70B') {
        stream = streamGroq(brainHistory, systemPrompt, 1024, "llama-3.3-70b-versatile");
    } else if (provider === 'GROQ_8B_VOICE') {
        stream = streamGroq(brainHistory, systemPrompt, 1024, "llama-3.1-8b-instant");
    } else {
        stream = streamWorkhorse(brainHistory, systemPrompt);
    }

    let fullTextResponse = "";

    try {
        for await (const chunk of stream) {
            if (!chunk) continue;
            fullTextResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    } catch (e) {
        console.error("Stream Failed:", e);
        // Failover to Groq 70B if Workhorse fails?
        if (provider === 'WORKHORSE_120B') {
             const fallbackStream = streamGroq(brainHistory, systemPrompt, 1024, "llama-3.3-70b-versatile");
             for await (const chunk of fallbackStream) {
                 if (!chunk) continue;
                 fullTextResponse += chunk;
                 (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
             }
        }
    }

    // =================================================================================
    // 5. AUDIO GENERATION (The Mouth)
    // =================================================================================
    // Check for Style Tag
    let styleDescription = undefined;
    const styleMatch = fullTextResponse.match(/\[STYLE:(.*?)\]/i);
    if (styleMatch) {
        styleDescription = styleMatch[1].trim();
    }

    const shouldGenerateAudio = (isPro || isVoiceMode) && fullTextResponse.trim().length > 0;
    let savedAudioUrl: string | undefined;

    if (shouldGenerateAudio) {
        const cleanText = cleanTextForTTS(fullTextResponse);
        if (cleanText.length > 0) {
            const targetPersona = (currentPersona === 'aarav' || currentPersona === 'aastik') ? 'aastik' : 'aastha';
            // Pass 'styleDescription' to Brain
            const audioBuffer = await brainService.generateSpeech(cleanText.substring(0, 2000), undefined, targetPersona, styleDescription);

            if (audioBuffer) {
                const audioId = `vn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                storeAudio(audioId, audioBuffer);
                savedAudioUrl = `/api/ai/stream/${audioId}`;
                (res as any).write(`data: ${JSON.stringify({ voice_audio: savedAudioUrl, voice_note: savedAudioUrl })}\n\n`);
            } else {
                (res as any).write(`data: ${JSON.stringify({ meta: { voice_status: "failed" } })}\n\n`);
            }
        }
    }

    // =================================================================================
    // 6. SAVE & MEMORY
    // =================================================================================

    // Strip Style Tag for DB
    const dbContent = fullTextResponse.replace(/\[STYLE:.*?\]/g, '').trim();

    chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
    chatSession.messages.push({ role: 'assistant', content: encrypt(dbContent), timestamp: new Date(), voice_note: savedAudioUrl });
    await chatSession.save();

    if (chatSession.messages.length % 5 === 0) {
        (async () => {
            try {
                const currentSummary = decrypt(user.memorySummary || "");
                const analysis = await generateMemoryAnalysis(historyWindow, currentSummary);

                // Update Inferred Gender if unknown
                if (user.inferredGender === 'Unknown' && analysis.inferredGender !== 'Unknown') {
                    await User.findByIdAndUpdate(userId, { inferredGender: analysis.inferredGender });
                }

                await User.findByIdAndUpdate(userId, { memorySummary: encrypt(analysis.summary) });
            } catch (e) { console.error("Memory Error:", e); }
        })();
    }

    // Data Donation
    if (user.isDataDonationOn) {
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
            // Safety: Strip tags just in case they were saved
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
