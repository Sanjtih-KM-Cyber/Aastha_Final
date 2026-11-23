import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { updateMemory } from '../services/memoryService';
import { buildCompanionPrompt, describeTime, describeAge, describeLanguage } from '../prompts/companion';
import { streamReply, ChatMessage, generateSubconscious, transcribeAudio, canSkipBrain, defaultBrain, wantsDeepThinking } from '../services/groqService';
import { updateStyle, describeStyle, updateBond, bondPromptLine, BOND_LEVELS } from '../services/relationship';
import { assessRisk, HELPLINES, CRISIS_PROMPT, CONCERN_PROMPT, CRISIS_FALLBACK_TEXT } from '../utils/safety';
import { LlmUnavailableError } from '../services/llm';
import { createVoiceTagExtractor } from '../utils/streamTags';
import { searchGif, gifsEnabled } from '../services/gifSearch';
import { hasValidConsent, decryptStyle, buildClonePrompt, cloneDisplayName, decodeVoiceSample, CLONE_DAILY_LIMIT } from '../services/cloneService';
import { brainService } from '../services/brainService';
import { broadcast } from '../services/socketService';
import User from '../models/User';
import { getRecentMessages, appendMessages, countMessages } from '../services/messageStore';
import TrainingLog from '../models/TrainingLog';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { storeAudio, parseAudioDataUrl } from './audioController';
import { captureError } from '../monitoring';
import { describeRecentReactions, setReaction, isAllowedReaction } from '../services/reactions';
import { followUpPromptLine, followUpsAroundNow, markFollowUps } from '../services/reachOut';
import { cleanTimeZone } from '../utils/timeZone';
import { openQuotaWindow, quotaResetsAt } from '../utils/dailyReset';

// ============================================================================
// HELPERS: TEXT CLEANING
// ============================================================================
/**
 * CLEANS TEXT FOR TTS ENGINE
 * Removes emojis, markdown, and text between asterisks (*sighs*)
 */
const cleanTextForTTS = (text: string): string => {
    return text
        .replace(/\[STYLE:.*?\]/g, '') // Remove style tags
        .replace(/\[TTS:.*?\]/g, '')   // Remove TTS content tags
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

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

  let { message, images, image, forceReply, audio, isVoiceMode, userLocalTime, userLocalHour, tempId, thinkingMode, timeZone } = (req as any).body;
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
    // Remember the device time zone → check-ins and "today" follow the user's own clock
    const tz = cleanTimeZone(timeZone);
    if (tz && (user as any).timeZone !== tz) (user as any).timeZone = tz;

    // =================================================================================
    // 0. WHISPER TRANSCRIPTION
    // =================================================================================
    // The user's own voice note is kept (encrypted, 30-day expiry) and shown as a bubble with its transcript (7.4).
    let userVoiceUrl: string | undefined;
    if (audio) {
        const parsed = parseAudioDataUrl(audio);
        if (!parsed) {
            (res as any).write(`data: ${JSON.stringify({ type: 'error', message: 'That recording could not be used (unsupported type or longer than ~2 minutes).' })}\n\n`);
            (res as any).write('data: [DONE]\n\n');
            return (res as any).end();
        }
        try {
            message = await transcribeAudio(parsed.buffer, parsed.ext);
        } catch (e) {
            console.error("Whisper Failed:", e);
            message = "[Audio Unintelligible]";
        }
        const vid = `uv-${crypto.randomUUID()}`;
        if (await storeAudio(vid, parsed.buffer, userId, { encrypt: true, mime: parsed.mime })) userVoiceUrl = `/api/ai/stream/${vid}`;
        (res as any).write(`data: ${JSON.stringify({ type: 'transcript', text: message, voice_note: userVoiceUrl })}\n\n`);
    }

    const LISTEN_INTENT_REGEX = /(want|like) to (listen|hear)( you)?|speak (to|with) me|talk to me/i;
    // @ts-ignore
    const hasListenIntent = LISTEN_INTENT_REGEX.test(message || "");
    // SAFETY FIRST (S9): deterministic check on every message, before any LLM.
    // (The old path returned plain JSON on an SSE stream, so the app silently dropped the helpline message.)
    const risk = typeof message === 'string' ? assessRisk(message) : 'none';
    if (risk !== 'none') {
        (res as any).write(`data: ${JSON.stringify({ type: 'safety', level: risk, helplines: HELPLINES })}\n\n`);
        if (risk === 'crisis') {
            forceReply = true;   // never stay silent in "listening" mode
            isVoiceMode = false; // text with tappable numbers, not a voice note
            // No proactive check-ins for 48 h after a crisis message (services/reachOut.ts)
            user.set('reachOut.lastCrisisAt', new Date());
        }
    }

    // RELATIONSHIP (A6): learn their texting style + grow closeness from real messages
    let bondLeveledUp = false;
    if (typeof message === 'string' && message.trim() && !audio) {
        user.styleProfile = updateStyle(user.styleProfile as any, message) as any;
    }
    if (typeof message === 'string' && message.trim()) {
        const bondUpdate = updateBond(user.bond as any, message, new Date(), (user as any).timeZone || cleanTimeZone(timeZone) || undefined);
        user.bond = { ...bondUpdate.state, override: (user.bond as any)?.override ?? null } as any;
        user.markModified('bond');
        bondLeveledUp = bondUpdate.leveledUp;
    }

    // BROADCAST USER MESSAGE (SYNC)
    if (message) {
         broadcast(userId.toString(), 'message', {
            content: message,
            role: 'user',
            timestamp: new Date(),
            tempId: tempId
        });
    }

    // =================================================================================
    // 1. MODEL SELECTION STRATEGY (Mixture of Agents)
    // =================================================================================
    // NOTE: these labels are only reported to the client as meta.model / mode. The actual model chain
    // is chosen in services/llm.ts (same quality for everyone; images route to a vision model).
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
    const recentMessages = await getRecentMessages(userId, 20);

    // Decrypt History
    const historyWindow: ChatMessage[] = recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: decrypt(m.content)
    }));

    const decryptedSummary = decrypt(user.memorySummary || "");
    const userFacts: string[] = (user.facts || []).map((f: string) => decrypt(f)).filter(Boolean);
    const userContextString = `User: ${userName}, Last mood: ${user.moodStatus}, Time: ${userLocalTime || "Unknown"}, Summary: ${decryptedSummary || "none"}`;

    let newUserMsgContent: any = message;
    if (images && images.length > 0) {
        newUserMsgContent = [
            { type: "text", text: message || "Analyze these images." },
            ...images.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ];
    }

    // CLONE MODE (consent-first). Crisis messages always go to Aastha with helplines instead.
    const cloneMode: any = user.cloneMode || {};
    const cloneStyle = decryptStyle(cloneMode.styleNotes);
    const cloneEnabled = !!cloneMode.isActive && hasValidConsent(cloneMode) && !!cloneStyle;
    const cloneLimitHit = cloneEnabled && (cloneMode.usageCount || 0) >= CLONE_DAILY_LIMIT;
    const useClone = cloneEnabled && !cloneLimitHit && risk !== 'crisis' && !(images && images.length);
    const cloneName = cloneEnabled ? cloneDisplayName(cloneMode) : '';
    if (cloneEnabled && risk === 'crisis') {
        (res as any).write(`data: ${JSON.stringify({ type: 'clone_paused', reason: 'safety' })}\n\n`);
    } else if (cloneLimitHit) {
        (res as any).write(`data: ${JSON.stringify({ type: 'clone_paused', reason: 'daily_limit', limit: CLONE_DAILY_LIMIT })}\n\n`);
    }

    // PERSISTENT LISTENING MODE CHECK
    let subconscious: any = {};

    if (useClone) {
        // The imitation just replies — no listening mode, no app tools
        subconscious = defaultBrain(user.moodStatus);
    } else if (user.isListeningModeActive && !forceReply) {
        // FAST PATH: STAY IN LISTENING MODE
        subconscious = {
            internal_monologue: "User is in persistent listening mode. Staying silent.",
            mood: user.moodStatus || 'neutral',
            status_display: 'Listening...',
            ui_action: 'listen',
            strategy: 'listen',
            reaction: null,
            suggested_replies: ["Can I reply now?", "I'm done", "Keep listening"],
            tool_calls: []
        };
    } else if (risk === 'crisis') {
        subconscious = { ...defaultBrain('concerned'), mood: 'concerned', status_display: 'Here with you...' };
    } else if (canSkipBrain(typeof message === 'string' ? message : '', !!forceReply, !!isVoiceMode) && !(images && images.length)) {
        // FAST PATH: obvious reply (question / greeting / forced / voice) — saves one LLM call (A2)
        subconscious = defaultBrain(user.moodStatus);
    } else {
        // NORMAL PATH: ASK BRAIN
        const brainHistory: ChatMessage[] = [...historyWindow, { role: 'user', content: newUserMsgContent }];
        subconscious = await generateSubconscious(brainHistory, userContextString, forceReply);
    }

    (res as any).write(`data: ${JSON.stringify({ type: 'thought', content: subconscious })}\n\n`);

    // UPDATE LISTENING STATE
    if (forceReply) {
        user.isListeningModeActive = false;
        await user.save();
    } else if (subconscious.strategy === 'listen') {
        if (!user.isListeningModeActive) {
            user.isListeningModeActive = true;
            await user.save();
        }
    }

    // FAIL-SAFE LISTENING MODE
    if (subconscious.strategy === 'listen') {
        if (subconscious.reaction) {
            (res as any).write(`data: ${JSON.stringify({ type: 'reaction', reaction: subconscious.reaction, messageId: recentMessages[recentMessages.length - 1]?._id })}\n\n`);
        }

        user.socialBattery = Math.max(0, user.socialBattery - 2);
        await user.save();

        (res as any).write('data: [DONE]\n\n');
        (res as any).end();

        // Save User Message Only
        await appendMessages(userId, [
            { role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), voice_note: userVoiceUrl }
        ]);
        return;
    }

    user.socialBattery = Math.max(0, user.socialBattery - 5);
    user.dailyMessageCount = (user.dailyMessageCount || 0) + 1;
    openQuotaWindow(user); // rolling 24 h window starts with the first counted message
    user.lastUsageDate = new Date();
    await user.save();

    // =================================================================================
    // 3. SYSTEM PROMPT & PERSONA ADAPTATION
    // =================================================================================
    const currentPersona = user.persona as string;
    const isAastik = currentPersona === 'aarav' || currentPersona === 'aastik';
    const voiceAvailable = !!(isPro || (user.voiceTopUpExpires && new Date(user.voiceTopUpExpires) > new Date()) || (user.dailyVoiceCount || 0) < 2);

    // GIF reactions: only in light moments, never in crisis/concern, clone or voice calls, and only if the user hasn't turned them off.
    // "What landed" (reactions) + a dated thing they mentioned that is happening around now (7.4)
    const reactionLine = useClone ? '' : await describeRecentReactions(userId).catch(() => '');
    const aroundNow = (useClone || risk !== 'none') ? [] : followUpsAroundNow(((user as any).followUps || []).map((f: any) => ({ ...(f.toObject ? f.toObject() : f), text: decrypt(f.text || '') })), new Date(), (user as any).timeZone);
    const followUpLine = followUpPromptLine(aroundNow, new Date(), (user as any).timeZone);

    const allowGifs = gifsEnabled() && user.gifsEnabled !== false && risk === 'none' && !useClone && !isVoiceMode &&
        !['sad', 'crying', 'angry', 'concerned', 'anxious', 'scared', 'lonely'].includes(String(subconscious.mood || '').toLowerCase());

    let systemPrompt = buildCompanionPrompt({
        persona: isAastik ? 'aastik' : 'aastha',
        userName: userName || 'Friend',
        userMood: subconscious.mood || 'neutral',
        innerNote: subconscious.internal_monologue || undefined,
        facts: userFacts.slice(-25),
        summary: decryptedSummary || undefined,
        timeContext: describeTime(userLocalTime, typeof userLocalHour === 'number' ? userLocalHour : undefined),
        ageContext: describeAge(user.dateOfBirth),
        isVoiceMode: !!isVoiceMode,
        voiceAvailable,
        styleLine: describeStyle(user.styleProfile as any),
        bondLine: bondPromptLine(user.bond as any, bondLeveledUp),
        languageLine: describeLanguage(user.preferredLanguage, user.region),
        safetyBlock: risk === 'crisis' ? CRISIS_PROMPT : risk === 'concern' ? CONCERN_PROMPT : undefined,
        thinking: false, // set below
        gifs: allowGifs,
        reactionLine,
        followUpLine,
    });
    // NOTE: brain tool_calls are turned into proposals by the client; asking the model to repeat them
    // here caused duplicate proposals, so that injection was removed.

    // THINKING MODE: auto for decisions/dilemmas; manual toggle for Pro. Never in crisis or voice calls.
    if (useClone) {
        systemPrompt = buildClonePrompt({ name: cloneName, subject: cloneMode.consent.subject, style: cloneStyle!, userName: userName || 'Friend' });
        cloneMode.usageCount = (cloneMode.usageCount || 0) + 1;
        cloneMode.lastActive = new Date();
        user.markModified('cloneMode');
        await user.save();
        (res as any).write(`data: ${JSON.stringify({ type: 'clone', name: cloneName, usedToday: cloneMode.usageCount, limit: CLONE_DAILY_LIMIT })}\n\n`);
    }

    const think = !useClone && risk !== 'crisis' && !isVoiceMode &&
        ((thinkingMode === true && isPro) || wantsDeepThinking(typeof message === 'string' ? message : ''));
    if (think) {
        systemPrompt = buildCompanionPrompt({
            persona: isAastik ? 'aastik' : 'aastha',
            userName: userName || 'Friend',
            userMood: subconscious.mood || 'neutral',
            innerNote: subconscious.internal_monologue || undefined,
            facts: userFacts.slice(-25),
            summary: decryptedSummary || undefined,
            timeContext: describeTime(userLocalTime, typeof userLocalHour === 'number' ? userLocalHour : undefined),
            ageContext: describeAge(user.dateOfBirth),
            voiceAvailable,
            styleLine: describeStyle(user.styleProfile as any),
            bondLine: bondPromptLine(user.bond as any, bondLeveledUp),
            languageLine: describeLanguage(user.preferredLanguage, user.region),
            safetyBlock: risk === 'concern' ? CONCERN_PROMPT : undefined,
            thinking: true,
            gifs: allowGifs,
            reactionLine,
            followUpLine,
        });
    }

    if (bondLeveledUp && ((user.bond as any)?.override === null || (user.bond as any)?.override === undefined)) {
        const lvl = (user.bond as any).level;
        (res as any).write(`data: ${JSON.stringify({ type: 'bond', level: lvl, name: BOND_LEVELS[lvl]?.name })}\n\n`);
    }

    // Messages left AFTER this one (msgCount was read before the increment above → pill lagged by one).
    const creditsDisplay = isPro ? '∞' : Math.max(0, 16 - Number(user.dailyMessageCount || 0));

    (res as any).write(`data: ${JSON.stringify({ 
        meta: { 
            model: provider,
            battery: user.socialBattery,
            mode: (isPro || isWithinFreeTier) ? 'pro' : 'standard', 
            credits: creditsDisplay,
            resetsAt: isPro ? null : quotaResetsAt(user)
        } 
    })}\n\n`);

    // =================================================================================
    // 4. STREAMING GENERATION (provider failover/backoff lives in services/llm.ts)
    // =================================================================================
    let fullTextResponse = "";
    const tagExtractor = createVoiceTagExtractor();
    const baseHistory: ChatMessage[] = useClone
        ? recentMessages
            .filter(m => m.role === 'user' || (m as any).isClone)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: decrypt(m.content) }))
        : historyWindow;
    const generationHistory: ChatMessage[] = [...baseHistory, { role: 'user', content: newUserMsgContent }];

    const sendContent = (text: string) => (res as any).write(`data: ${JSON.stringify({ content: text })}\n\n`);
    if (think) (res as any).write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);

    try {
        const stream = streamReply(generationHistory, systemPrompt, {
            voiceTags: risk !== 'crisis' && !useClone,
            think,
            onReasoning: (r) => (res as any).write(`data: ${JSON.stringify({ type: 'reasoning', content: r })}\n\n`),
        });
        for await (const chunk of stream) {
            const visible = tagExtractor.push(chunk);
            if (!visible) continue;
            fullTextResponse += visible;
            sendContent(visible);
        }
        const tail = tagExtractor.flush();
        if (tail) {
            fullTextResponse += tail;
            sendContent(tail);
        }
    } catch (e) {
        if (e instanceof LlmUnavailableError) {
            console.error("All AI providers unavailable for this request.");
        } else {
            console.error("Reply stream failed:", e);
        }
    }

    // A crisis message must ALWAYS get a caring answer with helplines, even if every AI provider is down.
    if (risk === 'crisis' && !fullTextResponse.trim()) {
        fullTextResponse = CRISIS_FALLBACK_TEXT;
        sendContent(CRISIS_FALLBACK_TEXT);
    }
    if (think) (res as any).write(`data: ${JSON.stringify({ type: 'thinking_end' })}\n\n`);

    // GIF reaction (tag already stripped from the visible text)
    let gif: Awaited<ReturnType<typeof searchGif>> = null;
    if (allowGifs && tagExtractor.captured.GIF && fullTextResponse.trim()) {
        gif = await searchGif(tagExtractor.captured.GIF);
        if (gif) (res as any).write(`data: ${JSON.stringify({ type: 'gif', gif })}\n\n`);
    }

    // =================================================================================
    // 5. AUDIO GENERATION (The Mouth)
    // =================================================================================
    let styleDescription: string | undefined = tagExtractor.captured.STYLE || undefined;

    // Check for Native Script TTS content
    const ttsContent: string | undefined = tagExtractor.captured.TTS || undefined;

    // Force Audio if Mood is High Emotion
    const isEmotional = risk !== 'crisis' && ['sad', 'crying', 'angry', 'concerned'].includes(subconscious.mood || '');
    // Voice Pass (₹19 / 24h) = unlimited voice while active; otherwise 2 free voice notes per day.
    const hasVoicePass = !!user.voiceTopUpExpires && new Date(user.voiceTopUpExpires) > new Date();
    const hasVoiceQuota = hasVoicePass || (user.dailyVoiceCount || 0) < 2;

    // Explicit User Intent (e.g. "Send voice note", "Speak to me")
    const explicitVoiceIntent = /(voice note|speak|say it|tell me|talk)/i.test(newUserMsgContent as string);

    // Only generate audio if:
    // 1. Voice Mode is ACTIVE (isVoiceMode)
    // 2. OR User explicitly asked for it
    // 3. OR Mood is deeply emotional (Sad/Crying only)
    const shouldGenerateAudio = ((isVoiceMode || explicitVoiceIntent || isEmotional) && (isPro || hasVoiceQuota)) && fullTextResponse.trim().length > 0;
    let savedAudioUrl: string | undefined;

    if (shouldGenerateAudio) {
        // Use ttsContent (Native Script) if available, otherwise use cleaned fullText (English/Glish)
        const textToSpeak = ttsContent || cleanTextForTTS(fullTextResponse);

        if (textToSpeak.length > 0) {
            const targetPersona = (currentPersona === 'aarav' || currentPersona === 'aastik') ? 'aastik' : 'aastha';
            let cloneVoice: Buffer | undefined;
            if (useClone && cloneMode.isVoiceActive) {
                const withVoice: any = await User.findById(userId).select('+cloneMode.voiceSample').lean();
                cloneVoice = decodeVoiceSample(withVoice?.cloneMode?.voiceSample);
            }
            const audioBuffer = await brainService.generateSpeech(textToSpeak.slice(0, 4000) /* brain_server trims at a sentence boundary */, cloneVoice, targetPersona, useClone ? undefined : styleDescription);

            if (audioBuffer) {
                const audioId = `vn-${crypto.randomUUID()}`; // unguessable: the stream URL is the only access key
                storeAudio(audioId, audioBuffer, userId);
                savedAudioUrl = `/api/ai/stream/${audioId}`;
                (res as any).write(`data: ${JSON.stringify({ voice_audio: savedAudioUrl, voice_note: savedAudioUrl })}\n\n`);

                user.dailyVoiceCount = (user.dailyVoiceCount || 0) + 1;
                await user.save();
            } else {
                (res as any).write(`data: ${JSON.stringify({ meta: { voice_status: "failed" } })}\n\n`);
            }
        }
    }

    // =================================================================================
    // 6. SAVE & MEMORY
    // =================================================================================

    // Clean all tags for DB (Style and TTS tags)
    const dbContent = fullTextResponse.replace(/\[STYLE:.*?\]/g, '').replace(/\[TTS:.*?\]/g, '').trim();

    // CRITICAL FIX: Do not save empty messages
    if (!dbContent && !savedAudioUrl) {
         console.warn("Generation yielded empty content. Skipping DB save to prevent crash.");
         (res as any).write(`data: ${JSON.stringify({ content: " I'm a little overwhelmed right now 😅 give me a minute and say that again?" })}\n\n`);
    } else {
        const saved = await appendMessages(userId, [
            { role: 'user', content: encrypt(typeof newUserMsgContent === 'string' ? newUserMsgContent : '[Multimedia]'), voice_note: userVoiceUrl },
            { role: 'assistant', content: encrypt(dbContent || "[...]"), voice_note: savedAudioUrl, ...(useClone ? { isClone: true } : {}), ...(gif ? { gif } : {}) },
        ]);
        // Real ids → the app can attach reactions to this reply (7.4)
        (res as any).write(`data: ${JSON.stringify({ type: 'saved', userId: String(saved[0]?._id || ''), assistantId: String(saved[1]?._id || '') })}\n\n`);
        // Asked about it in chat → no separate check-in notification
        if (followUpLine) await markFollowUps(userId, aroundNow.slice(0, 2).map((f: any) => f._id), 'asked').catch(() => {});

        // BROADCAST TO SYNC DEVICES
        broadcast(userId.toString(), 'message', {
            content: dbContent || "[...]",
            role: 'assistant',
            timestamp: new Date(),
            voice_note: savedAudioUrl,
            ...(gif ? { gif } : {})
        });
    }

    const totalMessages = await countMessages(userId);
    // Memory v2: every 6 stored messages (~3 exchanges), learn from the latest turns (incl. this one).
    if (!useClone && totalMessages % 6 === 0 && dbContent) {
        const turns = [
            ...historyWindow.slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: typeof m.content === 'string' ? m.content : '' })),
            { role: 'user' as const, content: typeof newUserMsgContent === 'string' ? newUserMsgContent : (message || '') },
            { role: 'assistant' as const, content: dbContent },
        ];
        updateMemory(userId.toString(), turns).catch(e => console.error("Memory Error:", e?.message || e));
    }

    // Data Donation - FIXED VALIDATION ERROR
    if (!useClone && user.isDataDonationOn && dbContent) {
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
    captureError(error, { route: 'chat' });
    if (!(res as any).headersSent) {
        (res as any).status(500).json({ message: 'Chat failed. Please try again.' });
    } else {
        (res as any).end();
    }
  }
};

export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

        // GET /api/chat/history?limit=50&before=<ISO timestamp>
        // Returns the newest `limit` messages (older than `before`), oldest → newest.
        // Only these are decrypted — previously the ENTIRE history was decrypted on every load (R5).
        const q = (req as any).query || {};
        const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 100);
        const before = typeof q.before === 'string' ? new Date(q.before) : undefined;

        const page = await getRecentMessages(req.user._id, limit, before);
        (res as any).setHeader('X-Has-More', page.length === limit ? '1' : '0');

        const history = page.map(m => {
            let decrypted = decrypt(m.content);
            decrypted = decrypted.replace(/\[STYLE:.*?\]/g, '').trim();

            return {
                id: String(m._id),
                role: m.role,
                content: decrypted,
                timestamp: m.timestamp,
                voice_note: m.voice_note,
                isClone: !!(m as any).isClone,
                ...((m as any).userReaction ? { myReaction: (m as any).userReaction } : {}),
                ...((m as any).gif?.url ? { gif: (m as any).gif } : {})
            };
        });

        (res as any).json(history);
    } catch (error) {
        console.error("History Error:", error);
        (res as any).status(500).json({ message: "Failed to fetch history" });
    }
};

/** POST /api/chat/react { messageId, reaction: <any single emoji> | null } — the user's reaction on one of Aastha's replies (7.4). */
export const reactToMessage = async (req: AuthRequest, res: Response) => {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const { messageId, reaction } = (req as any).body || {};
    if (typeof messageId !== 'string' || (reaction !== null && !isAllowedReaction(reaction))) {
        return (res as any).status(400).json({ message: 'Invalid reaction' });
    }
    try {
        const ok = await setReaction(req.user._id, messageId, reaction);
        if (!ok) return (res as any).status(404).json({ message: 'Message not found' });
        (res as any).json({ ok: true, reaction });
    } catch (e) {
        console.error('React error:', e);
        (res as any).status(500).json({ message: 'Could not save reaction' });
    }
};
