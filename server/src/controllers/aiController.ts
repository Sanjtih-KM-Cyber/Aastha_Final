import { Response } from 'express';
import { searchYouTube } from '../services/youtubeSearch';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import { getRecentMessages } from '../services/messageStore';
import Diary from '../models/Diary';
import { extractThemeFromImage, getMusicRecommendation, analyzeDiaryEntries, analyzeChatHistory, getVibePlaylist, songsForMinutes } from '../services/geminiService';
import { decrypt } from '../utils/serverEncryption';

// --- Helper: Internal YouTube Search ---
// Defined ONCE here and used below
// One cached YouTube lookup per song title (services/youtubeSearch.ts, A11)
const searchYouTubeInternal = async (query: string) => {
    const [first] = await searchYouTube(`${query} audio`, { max: 1, songsOnly: true });
    return first || null;
};

export const generateTheme = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { image } = (req as any).body;
        const themeData = await extractThemeFromImage(image);
        (res as any).json(themeData);
    } catch (e) { (res as any).status(500).json({ message: 'Theme gen failed' }); }
};

export const recommendMusic = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { mood } = (req as any).body;
        const recommendations = await getMusicRecommendation(mood || 'Neutral', []);
        (res as any).json(recommendations);
    } catch (e) { (res as any).status(500).json({ message: 'Music rec failed' }); }
};

// --- ANALYSIS CONTROLLERS ---

export const analyzeDiary = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        
        const entries = await Diary.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(14);
        
        if (entries.length === 0) return (res as any).json([]);

        const decryptedEntries = entries.map(e => ({
            createdAt: e.createdAt,
            content: decrypt(e.content)
        }));

        const analysis = await analyzeDiaryEntries(decryptedEntries);
        (res as any).json(analysis);
    } catch (e) {
        console.error(e);
        (res as any).status(500).json({ message: 'Analysis failed' });
    }
};

export const analyzeChat = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

        const latest = await getRecentMessages(req.user._id, 20);
        if (latest.length === 0) {
            return (res as any).json({ result: "No chat history found yet." });
        }

        const recentMessages = latest.map(m => ({
            role: m.role,
            content: decrypt(m.content)
        }));

        const insight = await analyzeChatHistory(recentMessages);
        (res as any).json({ result: insight });
    } catch (e) {
        console.error(e);
        (res as any).status(500).json({ message: 'Analysis failed' });
    }
};

// --- JAM CONTROLLER ---

export const generateVibePlaylist = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        
        const { languages, moods, genres, duration, year, specific_songs } = req.body; // Received from frontend

        // 1. Get Chat History
        const recentMessages = (await getRecentMessages(req.user._id, 15)).map(m => ({
            role: m.role,
            content: decrypt(m.content)
        }));

        // 2. Ask AI for Song Titles
        // Pass arrays to service
        const songTitles = await getVibePlaylist(recentMessages, languages, moods, duration, year, genres, specific_songs);

        // 3. Search YouTube: one real song per title (songsOnly: no Shorts, live streams or long mixes)
        const want = songsForMinutes(duration);
        const results = await Promise.all((songTitles || []).slice(0, want).map(title => searchYouTubeInternal(title)));
        const seen = new Set<string>();
        let tracks = results.filter((t): t is NonNullable<typeof t> => !!t && !seen.has(t.id) && !!seen.add(t.id));

        // 4. AI gave nothing usable → ONE search built from what they picked (was: a hard-coded Lofi Girl live-stream
        //    id that had ended, so Jam played ~8 s and stopped)
        if (tracks.length < 3) {
            const q = fallbackQuery({ languages, moods, genres, year });
            const more = await searchYouTube(q, { max: want, musicOnly: true, songsOnly: true });
            for (const t of more) if (!seen.has(t.id)) { seen.add(t.id); tracks.push(t); }
            tracks = tracks.slice(0, want);
        }

        if (tracks.length === 0) {
            console.warn('Vibe Gen: no playable songs (AI and YouTube both came back empty).');
            return (res as any).status(503).json({ message: "Couldn't find songs right now. Try searching for one, or try again in a bit." });
        }
        (res as any).json(tracks);
    } catch (e) {
        console.error('Vibe Gen error:', (e as any)?.message || e);
        (res as any).status(503).json({ message: "Couldn't make a playlist right now. Try again in a bit." });
    }
};

/** "Hindi Happy Pop songs 2010s" style search from the user's picks (never a fixed video). */
export const fallbackQuery = (p: { languages?: string[]; moods?: string[]; genres?: string[]; year?: string }) => {
    const pick = (a?: string[]) => (Array.isArray(a) ? a.filter(Boolean).slice(0, 2).join(' ') : '');
    return [pick(p.languages), pick(p.moods), pick(p.genres), 'songs', p.year || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        || 'feel good songs';
};