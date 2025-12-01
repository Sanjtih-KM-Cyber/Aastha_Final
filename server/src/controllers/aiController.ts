import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Chat from '../models/Chat';
import Diary from '../models/Diary';
import { extractThemeFromImage, getMusicRecommendation, analyzeDiaryEntries, analyzeChatHistory, getVibePlaylist } from '../services/geminiService';
import { decrypt } from '../utils/serverEncryption';
import axios from 'axios';

// --- Helper: Internal YouTube Search ---
// Defined ONCE here and used below
const searchYouTubeInternal = async (query: string) => {
    try {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) return null;
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { part: 'snippet', maxResults: 1, q: query + ' audio', type: 'video', key: apiKey }
        });
        
        if (response.data.items.length > 0) {
            const item = response.data.items[0];
            return {
                id: item.id.videoId,
                title: item.snippet.title,
                artist: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.default.url
            };
        }
        return null;
    } catch (e) { return null; }
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

        const chat = await Chat.findOne({ user: req.user._id });
        if (!chat || chat.messages.length === 0) {
            return (res as any).json({ result: "No chat history found yet." });
        }

        const recentMessages = chat.messages.slice(-20).map(m => ({
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
        
        const { languages, moods, duration } = req.body; // Received from frontend (duration in minutes)

        // 1. Get Chat History
        const chat = await Chat.findOne({ user: req.user._id });
        const recentMessages = chat ? chat.messages.slice(-15).map(m => ({
            role: m.role,
            content: decrypt(m.content)
        })) : [];

        // 2. Ask AI for Song Titles
        // Pass arrays to service
        const songTitles = await getVibePlaylist(recentMessages, languages, moods, duration);

        // 3. Search YouTube
        // Uses the searchYouTubeInternal defined at the top of the file
        const searchPromises = songTitles.map(title => searchYouTubeInternal(title));
        const results = await Promise.all(searchPromises);
        const tracks = results.filter(t => t !== null);

        (res as any).json(tracks);

    } catch (e) {
        console.error(e);
        (res as any).status(500).json({ message: 'Failed to generate vibe.' });
    }
};