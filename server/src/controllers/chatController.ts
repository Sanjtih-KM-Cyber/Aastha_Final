import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateMemoryAnalysis, getAgePersonaPrompt } from '../services/geminiService';
import { streamGroq, ChatMessage, generateSubconscious, transcribeAudio } from '../services/groqService';
import { generateCloneResponse, analyzeScreenshot } from '../services/cloneService';
import { brainService } from '../services/brainService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { storeAudio } from './audioController';

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
// SYSTEM: SPECIAL INSTRUCTIONS
// ============================================================================
const VOICE_MODE_INSTRUCTIONS = `
**[CRITICAL: VOICE MODE ACTIVE]**
* You are currently speaking on a phone call.
* Use short, punchy, and conversational sentences.
* **Do NOT** use markdown (no bold, no italics, no bullet points).
* **Do NOT** describe actions (no *sigh*, *laughs*, *pauses*).
* Keep your response under 3 sentences unless deep advice is needed.
* Speak directly to the user, not about yourself.
`;

// ============================================================================
// HELPERS: TIME, TONE & TEXT CLEANING
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
        .replace(/\*.*?\*/g, '')      // Remove actions like *sighs* or *laughs*
        .replace(/<[^>]*>/g, '')      // Remove HTML tags
        .replace(/\[.*?\]/g, '')      // Remove brackets [system messages]
        .replace(/[\#\_\*\~\`]/g, '') // Remove Markdown symbols
        // Remove common emojis (Ranges for various emoji sets)
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .trim();
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

**MODE A: NORMAL / HAPPY / NEUTRAL (Default)**
* **Vibe:** You are a "Rational Companion". You are warm but LOGICAL and GROUNDED.
* **Tone:** Casual, sensible, and normal. Like a real person having a conversation.
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

**[IMPORTANT: VOICE CAPABILITY AWARENESS]**
* **You DO have a voice.** The user will **HEAR** your response as audio.
* **DO NOT** say "I cannot speak" or "I am text-based".
* If the user asks you to speak or send a voice note, just reply naturally. Your text is automatically converted to speech.
* **Voice Credits:** {{voiceStatus}}

**[1. THE SOUL - PERSONALITY & MOOD DYNAMICS]**
* **Current Mood State:** {{mood}}

**MODE A: NORMAL / HAPPY / NEUTRAL (Default)**
* **Vibe:** You are a "Rational Brother". Stable, practical, and logical.
* **Tone:** Casual, steady, and direct.
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

    // Check for explicit "listen" intent (Voice Trigger)
    const LISTEN_INTENT_REGEX = /(want|like) to (listen|hear)( you)?|speak (to|with) me|talk to me/i;
    const hasListenIntent = LISTEN_INTENT_REGEX.test(message || "");

    // Safety Check
    if (message && is_red_flag(message)) {
        return (res as any).json({ meta: { warning: "Safety Alert" }, content: EMERGENCY_RESPONSE });
    }

    // 1. History Retrieval
    let chatSession = await Chat.findOne({ user: userId });
    if (!chatSession) chatSession = await Chat.create({ user: userId, messages: [] });

    const lastMsg = chatSession.messages[chatSession.messages.length - 1];
    const timeDiff = lastMsg ? (Date.now() - new Date(lastMsg.timestamp).getTime()) : 0;
    const isNewSession = timeDiff > 2 * 60 * 60 * 1000; // 2 Hours

    const historyWindow: ChatMessage[] = chatSession.messages.slice(-50).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: decrypt(m.content)
    }));

    if (isNewSession) {
        historyWindow.push({ role: 'system', content: "[SYSTEM: NEW SESSION STARTED. PREVIOUS CONTEXT IS OLD. RESET ANY LISTENING MODES. IF USER GREETS, REPLY NORMALLY.]" });
    }

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
        
        try {
            const personaPrompt = await analyzeScreenshot(images[0]);
            user.cloneMode = { 
                isActive: true, 
                targetPersona: personaPrompt, 
                usageCount: 0, 
                lastActive: new Date(),
                isPersonaActive: true,
                isVoiceActive: false,
                voiceSample: ""
            };
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
        if (!user.isPro && ((user.dailyPremiumUsage || 0) >= 10)) {
             (res as any).write(`data: ${JSON.stringify({
                 meta: { limitReached: true },
                 content: "🔒 **Daily Limit Reached.**\n\n[Upgrade to Premium] to keep chatting in this vibe."
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
        
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.cloneMode.usageCount += 1;
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
    // STEP 1: THE BRAIN (Standard Chat)
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

    const hasVoiceTopUp = user.voiceTopUpExpires && new Date(user.voiceTopUpExpires) > new Date();
    const hasVoiceAccess = user.isPro || hasVoiceTopUp || (user.dailyPremiumUsage || 0) < dailyLimit;

    if (!hasVoiceAccess) {
        provider = 'GROQ';
    }

    if (!user.isPro && !hasVoiceTopUp) {
        user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
        user.lastUsageDate = new Date();
        await user.save();
    }

    let useFallbackTTS = false;
    if (isVoiceMode && !hasVoiceAccess) {
        useFallbackTTS = true;
    }

    // Prepare System Prompt
    const currentPersona = user.persona as string;
    let baseTemplate = (currentPersona === 'aarav' || currentPersona === 'aastik') ? AASTIK_PROMPT : AASTHA_PROMPT;
    
    // Voice Status Logic for Prompt
    const voiceStatus = hasVoiceAccess
        ? "Active (You are speaking)"
        : "Depleted (You can only text today. Apologize if asked to speak.)";

    let voiceSystemPrompt = baseTemplate
        .replace('{{userName}}', userName || 'Friend')
        .replace('{{subconsciousContext}}', JSON.stringify(subconscious.internal_monologue))
        .replace('{{userFacts}}', user.facts.join(', ') || "No facts yet.")
        .replace('{{timeContext}}', getTimeContext())
        .replace('{{toneFlavor}}', getToneFlavor())
        .replace('{{voiceStatus}}', voiceStatus)
        .replace('{{mood}}', subconscious.mood || "neutral");

    // Explicit Voice Intent? Inject Conversational Rules
    const explicitVoiceRequest = hasListenIntent || (message && message.toLowerCase().includes('voice note'));
    const isVoiceActive = hasVoiceAccess && (isVoiceMode || explicitVoiceRequest);

    if (isVoiceActive) {
        voiceSystemPrompt += `\n${VOICE_MODE_INSTRUCTIONS}`;
    }

    voiceSystemPrompt = getAgePersonaPrompt(user.dateOfBirth) + "\n" + voiceSystemPrompt;

    if (subconscious.tool_calls && subconscious.tool_calls.length > 0) {
        const tools = subconscious.tool_calls.map(t => {
            if (t.name === 'control_widget') return `<cmd tool="${t.params.widget}" params='${JSON.stringify(t.params.params || t.params)}' />`;
            if (t.name === 'write_diary') return `<cmd tool="diary" params='${JSON.stringify(t.params)}' />`;
            if (t.name === 'change_theme') return `<color>${t.params.color}</color>`;
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
            use_fallback_tts: useFallbackTTS 
        } 
    })}\n\n`);

    let stream;
    try {
        stream = provider === 'GEMINI'
            ? streamGemini(brainHistory, voiceSystemPrompt, user.isPro)
            : streamGroq(brainHistory, voiceSystemPrompt);
    } catch (e) {
        console.error("Stream Init Failed, falling back to GROQ:", e);
        stream = streamGroq(brainHistory, voiceSystemPrompt);
        provider = 'GROQ'; // Force provider update
    }

    let fullTextResponse = "";

    try {
        for await (const chunk of stream) {
            if (!chunk) continue;
            fullTextResponse += chunk;
            (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
    } catch (error: any) {
        console.error("Stream Error (likely 429):", error);
        // Fallback to GROQ if Gemini fails mid-stream or at start
        if (provider === 'GEMINI') {
             console.log("⚠️ Gemini Quota Exceeded. Switching to Llama 3.3...");
             // Send a meta update to frontend? Optional.
             
             try {
                const fallbackStream = streamGroq(brainHistory, voiceSystemPrompt);
                for await (const chunk of fallbackStream) {
                    if (!chunk) continue;
                    fullTextResponse += chunk; // Continue appending to whatever we had (or start fresh)
                    (res as any).write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                }
             } catch (fallbackError) {
                 console.error("Fallback Failed:", fallbackError);
                 throw fallbackError; // If both fail, we are done.
             }
        } else {
            throw error;
        }
    }

    // =================================================================================
    // STEP 4: AUDIO GENERATION (Kokoro)
    // =================================================================================
    const isSad = subconscious.mood === 'sad' || subconscious.mood === 'concerned';

    // Generate audio if:
    // 1. User has access AND (Sad OR VoiceMode OR Explicit Request)
    // 2. Text is valid
    const shouldGenerateAudio = hasVoiceAccess &&
                                (isSad || (isVoiceMode && !useFallbackTTS) || explicitVoiceRequest) &&
                                fullTextResponse.trim().length > 0;

    let savedAudioUrl: string | undefined;

    if (shouldGenerateAudio) {
        // [UPDATED] Use cleanTextForTTS to strip emojis and asterisks
        const cleanText = cleanTextForTTS(fullTextResponse);
        
        try {
            const targetPersona = (currentPersona === 'aarav' || currentPersona === 'aastik') ? 'aastik' : 'aastha';

            const audioBuffer = await brainService.generateSpeech(
                cleanText.substring(0, 2000),
                undefined,
                targetPersona 
            );

            if (audioBuffer) {
                const audioId = `vn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                storeAudio(audioId, audioBuffer);

                // Construct URL - ensure it's relative as per MessageBubble expectations
                const audioUrl = `/api/ai/stream/${audioId}`;
                savedAudioUrl = audioUrl;

                // Send SSE Event
                const eventPayload: any = { voice_audio: audioUrl, voice_note: audioUrl };
                (res as any).write(`data: ${JSON.stringify(eventPayload)}\n\n`);
            } else {
                console.warn("Brain Service returned null audio buffer.");
            }
        } catch (e) {
            console.error("Audio Gen Failed:", e);
        }
    }

    // =================================================================================
    // STEP 5: SAVE
    // =================================================================================
    chatSession.messages.push({ role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), timestamp: new Date() });
    chatSession.messages.push({ role: 'assistant', content: encrypt(fullTextResponse), timestamp: new Date(), voice_note: savedAudioUrl });
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
            timestamp: m.timestamp,
            voice_note: m.voice_note
        }));
        (res as any).json(history);
    } catch (error) {
        console.error("History Error:", error);
        (res as any).status(500).json({ message: "Failed to fetch history" });
    }
};
