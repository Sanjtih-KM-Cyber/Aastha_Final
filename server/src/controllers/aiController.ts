import { Response } from 'express';
import { searchYouTube } from '../services/youtubeSearch';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import { getRecentMessages } from '../services/messageStore';
import Diary from '../models/Diary';
import { extractThemeFromImage, getMusicRecommendation, analyzeDiaryEntries, analyzeChatHistory, getVibePlaylist } from '../services/geminiService';
import { decrypt } from '../utils/serverEncryption';

// --- Helper: Internal YouTube Search ---
// Defined ONCE here and used below
// One cached YouTube lookup per song title (services/youtubeSearch.ts, A11)
const searchYouTubeInternal = async (query: string) => {
    const [first] = await searchYouTube(`${query} audio`, { max: 1 });
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

        // 3. Search YouTube
        // Uses the searchYouTubeInternal defined at the top of the file
        // Cap at 10 songs per playlist, each uncached title costs 100 YouTube quota units
        const searchPromises = (songTitles || []).slice(0, 10).map(title => searchYouTubeInternal(title));
        const results = await Promise.all(searchPromises);
        let tracks = results.filter(t => t !== null);

        // 4. Emergency Fallback (Ensure we never return empty)
        if (tracks.length === 0) {
            console.warn("Vibe Gen: No tracks found (AI or YouTube failed). Using Fallback.");
            tracks = [{
                id: 'jfKfPfyJRdk', // Lofi Girl Radio
                title: 'lofi hip hop radio - beats to relax/study to',
                artist: 'Lofi Girl',
                thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'
            }];
        }

        (res as any).json(tracks);

    } catch (e) {
        console.error(e);
        // Even in catch, return fallback instead of erroring
        (res as any).json([{
            id: 'jfKfPfyJRdk',
            title: 'lofi hip hop radio - beats to relax/study to',
            artist: 'Lofi Girl (Safe Mode)',
            thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'
        }]);
    }
};