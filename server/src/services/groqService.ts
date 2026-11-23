/**
 * Chat-facing AI helpers. Provider selection, retries, cooldowns and failover live in ./llm.ts.
 * (File name kept for import compatibility, it is no longer Groq-specific.)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { streamChat, completeChat, LlmMessage } from './llm';

dotenv.config();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface SubconsciousBlock {
    internal_monologue: string;
    mood: 'happy' | 'sad' | 'concerned' | 'sassy' | 'calm' | 'excited' | 'neutral' | 'angry';
    status_display: string;
    ui_action: 'none' | 'listen';
    strategy: 'reply' | 'listen';
    reaction: string | null;
    suggested_replies: string[];
    tool_calls?: {
        name: 'write_diary' | 'read_diary' | 'control_widget' | 'update_dossier' | 'change_theme';
        params: any;
    }[];
}

const VALID_MOODS = ['happy', 'sad', 'concerned', 'sassy', 'calm', 'excited', 'neutral', 'angry'];

// ============================================================================
// 1. THE BRAIN (mood / listen-vs-reply / reaction / suggestion chips)
// ============================================================================

const GREETING = /^(hi+|hey+|hello+|hii+|yo|sup|namaste|namaskar|vanakkam|good\s*(morning|afternoon|evening|night)|gm|gn)\b[\s!.,?🙂😊👋]*$/i;

/**
 * Cheap, deterministic cases where the brain call adds nothing, skipping it saves one LLM call
 * (and its rate-limit budget) per message (ROADMAP A2). The reply model still chooses tools itself.
 */
export const canSkipBrain = (message: string | undefined, forceReply: boolean, isVoiceMode: boolean): boolean => {
    if (forceReply || isVoiceMode) return true;
    const text = (message || '').trim();
    if (!text) return false;
    if (text.endsWith('?')) return true; // a direct question always gets a reply
    if (GREETING.test(text)) return true;
    return false;
};

export const defaultBrain = (previousMood?: string): SubconsciousBlock => ({
    internal_monologue: '',
    mood: (VALID_MOODS.includes(previousMood || '') ? previousMood : 'neutral') as SubconsciousBlock['mood'],
    status_display: 'Typing...',
    ui_action: 'none',
    strategy: 'reply',
    reaction: null,
    suggested_replies: [],
    tool_calls: [],
});

const BRAIN_PROMPT = (userContext: string) => `
You read a chat between a user and their companion and decide how the companion should react.
You never write the companion's reply. Output one JSON object only.

User context: ${userContext}

Decide:
- strategy: "listen" only if the user is clearly mid-thought (unfinished sentence, "and...", "wait", sending a vent in pieces). Otherwise "reply". Greetings, questions and short/dry messages ("ok", "nice") are always "reply".
- mood: the USER's current emotional state, one of ${VALID_MOODS.join(', ')}.
- reaction: one emoji the companion would react with, or null. Sad → 🫂 or 💔; ranting → 😯; funny → 😂; sweet → 🥰.
- suggested_replies: 0-3 short things the USER might say next, written in the user's voice and language (e.g. "I feel anxious", "Play some music"). Never write them as the companion.
- tool_calls: only if the user asked for something the app can do (music, soundscape, focus timer, breathing, diary, theme). Otherwise [].
  Shapes: {"name":"control_widget","params":{"widget":"jam|soundscape|pomodoro|breathing","params":{...}}}, {"name":"change_theme","params":{"color":"blue"}}
- internal_monologue: one short sentence on what the user needs right now.

JSON shape:
{"internal_monologue":"","mood":"neutral","strategy":"reply","reaction":null,"suggested_replies":[],"tool_calls":[]}
`;

const parseJsonObject = (raw: string): any => {
    try { return JSON.parse(raw); } catch { /* fall through */ }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON object in brain output');
    return JSON.parse(m[0]);
};

export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {
    const messages: LlmMessage[] = [
        { role: 'system', content: BRAIN_PROMPT(userContext) },
        ...history.slice(-6).map(m => ({
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: typeof m.content === 'string' ? m.content : '[image]'
        })),
    ];

    try {
        const raw = await completeChat(messages, { task: 'brain', temperature: 0.3, maxTokens: 400, json: true });
        const p = parseJsonObject(raw);

        const block: SubconsciousBlock = {
            internal_monologue: String(p.internal_monologue || ''),
            mood: VALID_MOODS.includes(p.mood) ? p.mood : 'neutral',
            status_display: p.strategy === 'listen' ? 'Listening...' : 'Typing...',
            strategy: p.strategy === 'listen' && !forceReply ? 'listen' : 'reply',
            ui_action: 'none',
            reaction: typeof p.reaction === 'string' && p.reaction.length <= 8 ? p.reaction : null,
            suggested_replies: Array.isArray(p.suggested_replies) ? p.suggested_replies.slice(0, 3).map(String) : [],
            tool_calls: Array.isArray(p.tool_calls) ? p.tool_calls : [],
        };
        block.ui_action = block.strategy === 'listen' ? 'listen' : 'none';
        if (block.strategy === 'listen' && !block.reaction) block.reaction = '👇';
        return block;
    } catch (error: any) {
        console.error('Subconscious failed, defaulting to reply:', error?.message || error);
        return defaultBrain();
    }
};

// ============================================================================
// 2. REPLY STREAMING
// ============================================================================
const VOICE_TAG_INSTRUCTIONS = `
[Voice output]
If you reply in a regional language or Hinglish, add at the very end: [STYLE: <emotion>, <speed>][TTS: <the same reply written in native script>].
For plain English replies add nothing.`;

const toLlmMessages = (history: ChatMessage[], systemPrompt: string): LlmMessage[] => [
    { role: 'system', content: systemPrompt },
    ...history
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as LlmMessage['content'] })),
];

/** Streams the companion's reply (images in the latest message are passed to a vision model). */
export async function* streamReply(
    history: ChatMessage[],
    systemPrompt: string,
    opts: { maxTokens?: number; voiceTags?: boolean; think?: boolean; onReasoning?: (t: string) => void } = {}
) {
    const prompt = opts.voiceTags ? `${systemPrompt}\n${VOICE_TAG_INSTRUCTIONS}` : systemPrompt;
    const hasImages = history.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
    // Think mode uses reasoning models (text only); images always go to the vision chain.
    const task = opts.think && !hasImages ? 'think' : 'chat';
    yield* streamChat(toLlmMessages(history, prompt), {
        task,
        temperature: task === 'think' ? 0.6 : 0.85, // a little more natural variety (less 'assistant-flat')
        maxTokens: opts.maxTokens || (task === 'think' ? 2048 : 1024),
        onReasoning: task === 'think' ? opts.onReasoning : undefined,
    });
}

/** Heuristic: messages where slower, deeper reasoning genuinely helps (decisions, dilemmas). */
export const wantsDeepThinking = (message?: string): boolean =>
    /\b(should i|what should i do|help me (decide|choose|think)|confused (about|between)|which (one|option) should|pros and cons|torn between|dilemma|can'?t decide|kya karu|kya karun|samajh nahi aa raha)\b/i
        .test(message || '');

// Backwards-compatible names
export const streamGroq = (history: ChatMessage[], systemPrompt: string, maxTokens?: number) =>
    streamReply(history, systemPrompt, { maxTokens, voiceTags: true });
export const streamWorkhorse = (history: ChatMessage[], systemPrompt: string, maxTokens?: number) =>
    streamReply(history, systemPrompt, { maxTokens, voiceTags: true });

// ============================================================================
// 3. WHISPER TRANSCRIPTION
// ============================================================================
const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',').map(k => k.trim()).filter(Boolean);

export const transcribeAudio = async (audioBuffer: Buffer, ext = 'm4a'): Promise<string> => {
    if (groqKeys.length === 0) return "[Audio processing unavailable]";
    // Unique temp file per request (concurrent uploads used to collide)
    const tempPath = path.join(os.tmpdir(), `aastha_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'm4a'}`);
    fs.writeFileSync(tempPath, audioBuffer);
    try {
        const start = Math.floor(Math.random() * groqKeys.length);
        for (let i = 0; i < Math.min(3, groqKeys.length); i++) {
            const keyIndex = (start + i) % groqKeys.length;
            try {
                const client = new Groq({ apiKey: groqKeys[keyIndex], maxRetries: 0 });
                const transcription: any = await client.audio.transcriptions.create({
                    file: fs.createReadStream(tempPath),
                    model: "whisper-large-v3",
                    response_format: "json",
                    temperature: 0.0
                } as any);
                return transcription.text;
            } catch (error: any) {
                console.warn(`Whisper key ${keyIndex + 1} failed (${error?.status ?? ''}). Trying next...`);
            }
        }
        return "[Audio processing failed due to server load]";
    } finally {
        fs.unlink(tempPath, () => {});
    }
};
