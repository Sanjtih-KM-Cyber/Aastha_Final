import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { ChatMessage } from './groqService';
import { completeChat } from './llm';

dotenv.config();

// ==========================================
// 1. KEY ROTATION & SPLITTING ENGINE
// ==========================================

let freeTierKeys: string[] = [];
let proTierKeys: string[] = [];
let keysInitialized = false;

const initKeys = () => {
    if (keysInitialized) return;

    const allGeminiKeys = (process.env.GEMINI_API_KEYS || process.env.API_KEY || '')
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    const N = allGeminiKeys.length;

    if (N === 0) {
        console.error("FATAL ERROR: No GEMINI_API_KEYS found. AI features will be unavailable.");
        keysInitialized = true;
        return;
    }

    const FREE_POOL_SHARE = 0.60;
    const FREE_POOL_SIZE = Math.ceil(N * FREE_POOL_SHARE);

    if (N >= 2) {
        freeTierKeys = allGeminiKeys.slice(0, FREE_POOL_SIZE);
        proTierKeys = allGeminiKeys.slice(FREE_POOL_SIZE);
        if (proTierKeys.length === 0) proTierKeys = allGeminiKeys;
    } else {
        freeTierKeys = allGeminiKeys;
        proTierKeys = allGeminiKeys;
    }

    console.log(`[AI SERVICE] Total Keys: ${N}. PRO Pool: ${proTierKeys.length}. FREE Pool: ${freeTierKeys.length}.`);
    keysInitialized = true;
};

// Exported for other services
export const getGeminiClient = (isPro: boolean = false) => {
  initKeys(); 

  const pool = isPro ? proTierKeys : freeTierKeys;
  
  if (!pool || pool.length === 0) {
      console.warn("Gemini Client requested but no keys available.");
      return new GoogleGenerativeAI('MISSING_KEY');
  }

  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  return new GoogleGenerativeAI(randomKey);
};

// ==========================================
// 4. GHOST WRITER (The Subconscious Emailer)
// ==========================================
interface IGhostContext {
    name: string;
    keywords: string;
    facts: string[];
    lore: string[];
    openLoop?: string;
    persona?: 'aastha' | 'aastik' | 'aarav'; // Passed from User
}

export const generateGhostEmailContent = async (context: IGhostContext): Promise<string> => {
    const isAastik = context.persona === 'aastik' || context.persona === 'aarav';
    const senderName = isAastik ? 'Aastik' : 'Aastha';
    const voice = isAastik
        ? 'a steady, low-key, loyal friend, calm and warm, a little dry humour'
        : 'a warm, grounded friend, gentle and a little playful';

    // A gentle, no-pressure check-in (ROADMAP A10). Never guilt, never "needy", never imply they owe a reply.
    const prompt = `Write a short check-in message from ${senderName} (${voice}) to ${context.name}, who hasn't opened the app for a day or two.
${context.openLoop ? `They mentioned this was coming up: "${context.openLoop}". You may ask how it went.` : ''}
${!context.openLoop && context.keywords && context.keywords !== 'life' ? `Last time they were thinking about: "${context.keywords}". You may reference it lightly.` : ''}
Rules: 1–2 sentences. Plain text, no subject line. No guilt, no "I missed you so much", no drama, no questions about why they were away.
Make it clear there's no pressure to reply, you're just around if they want to talk.`;

    try {
        const text = await completeChat([{ role: 'user', content: prompt }], { task: 'chat', temperature: 0.8, maxTokens: 120 });
        return text.trim();
    } catch (error) {
        console.error("[Ghost] Email generation error:", error);
        return isAastik
            ? "oye, where did you disappear to? update me when you're free"
            : "heyy, where did you vanish 👀 tell me what I missed";
    }
};

// ==========================================
// 5. AI HELPERS, all via services/llm.ts (failover, cooldowns, no direct Gemini calls)
// ==========================================
const ask = (prompt: string, opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}) =>
    completeChat([{ role: 'user', content: prompt }], { task: 'chat', temperature: opts.temperature ?? 0.5, maxTokens: opts.maxTokens ?? 600, json: opts.json });

const parseJson = <T>(text: string, fallback: T): T => {
    try { return JSON.parse(text); } catch { /* fall through */ }
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (!m) return fallback;
    try { return JSON.parse(m[0]); } catch { return fallback; }
};

/**
 * Wallpaper → theme colour now happens ON THE DEVICE with Material's own algorithm
 * (client/src/design/materialTheme.ts → seedFromImage). This endpoint stays for old app versions.
 */
export const extractThemeFromImage = async (_base64Image: string): Promise<any> =>
    ({ primaryColor: "#8B7CF6", accentColor: "#f472b6", themeName: "Lotus" });

export const getMusicRecommendation = async (prompt: string, userHistory: string[] = []): Promise<any> => {
    try {
        const text = await ask(`You are a thoughtful DJ. Mood/request: "${String(prompt).slice(0, 200)}". Recently played: ${userHistory.slice(-10).join(', ') || 'none'}.
Return JSON: {"songs": ["Song - Artist", ...]} with 8 songs.`, { json: true });
        const parsed = parseJson<any>(text, {});
        return Array.isArray(parsed) ? parsed : (parsed.songs || []);
    } catch { return null; }
};

export const analyzeDiaryEntries = async (entries: any[]): Promise<any> => {
    try {
        const textData = entries.slice(-20).map(e => `[${e.createdAt}]: ${e.content}`).join('\n\n');
        const text = await ask(`Read these private diary entries and write a short, warm reflection (3-5 sentences) on patterns in how the writer has been feeling. No diagnosis, no lists.
Return JSON: {"analysis": "..."}

${textData}`, { json: true, maxTokens: 500 });
        return parseJson(text, { analysis: "Unable to analyze." });
    } catch { return { analysis: "Unable to analyze." }; }
};

export const analyzeChatHistory = async (chatHistory: any[]): Promise<string> => {
    try {
        const textData = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        return await ask(`Give a short, kind emotional summary (3-4 sentences) of how the user seems to be feeling in this chat. No diagnosis.\n\n${textData}`, { maxTokens: 300 });
    } catch { return "Unable to analyze."; }
};

// Each uncached song title is one YouTube search (100 of 10,000 daily quota units), so playlists stay ≤ 12 songs.
export const MAX_PLAYLIST_SONGS = 12;
/** ~3.5 min a song: 15 min → 4, 30 → 9, 45 → 12 (cap). */
export const songsForMinutes = (minutes?: number) => Math.max(4, Math.min(MAX_PLAYLIST_SONGS, Math.round((Number(minutes) || 30) / 3.5)));

export const getVibePlaylist = async (
    chatHistory: any[],
    languages: string[],
    userMoods: string[],
    duration?: number,
    year?: string,
    genres?: string[],
    specificSongs?: string[]
): Promise<string[]> => {
    try {
        const textData = chatHistory.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `Create a music playlist for this person right now.
Context (recent chat): ${textData}
Languages: ${languages?.join(', ') || "Any"}
Moods: ${userMoods?.join(', ') || "Infer from context"}
Genres: ${genres?.join(', ') || "Any"}
Era: ${year || "Any"}
Length: about ${duration || 30} minutes (${songsForMinutes(duration)} real, well-known songs, each a normal 2 to 6 minute track, no mixes or live streams).
${specificSongs && specificSongs.length > 0 ? `Include these first: ${specificSongs.join(', ')}` : ''}
Return JSON: {"songs": ["Song - Artist", ...]}`;
        const parsed = parseJson<any>(await ask(prompt, { json: true }), {});
        const songs = Array.isArray(parsed) ? parsed : parsed.songs;
        // No made-up fallback title here: it used to be "Lo-Fi Beats - Lofi Girl", whose top YouTube hit was an 8 s clip.
        // The controller falls back to a mood/genre search instead.
        return Array.isArray(songs) ? songs.map(String).filter(Boolean).slice(0, MAX_PLAYLIST_SONGS) : [];
    } catch { return []; }
};
