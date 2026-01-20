import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Diary from '../models/Diary';
import Mood from '../models/Mood';
import { Person } from '../models/Person';
import axios from 'axios';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { detectiveService } from '../services/detectiveService';

// --- Diary Controllers ---

export const getDiaryEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    // Sort by entryDate (logical date) instead of creation date
    const entries = await Diary.find({ user: req.user._id }).sort({ entryDate: -1 });
    
    let migrationPromises: Promise<any>[] = [];

    const decryptedEntries = entries.map(entry => {
        let needsSave = false;

        const originalTitle = entry.title;
        const decryptedTitle = decrypt(originalTitle);
        const reEncryptedTitle = encrypt(decryptedTitle);

        if (originalTitle !== reEncryptedTitle) {
            entry.title = reEncryptedTitle;
            needsSave = true;
        }

        const originalContent = entry.content;
        const decryptedContent = decrypt(originalContent);
        const reEncryptedContent = encrypt(decryptedContent);

        if (originalContent !== reEncryptedContent) {
            entry.content = reEncryptedContent;
            needsSave = true;
        }

        if (needsSave) {
            migrationPromises.push(entry.save());
        }

        return {
            ...entry.toObject(),
            title: decryptedTitle,
            content: decryptedContent,
            // Fallback for legacy entries without entryDate (though default should handle it)
            entryDate: entry.entryDate || entry.createdAt
        };
    });

    if (migrationPromises.length > 0) {
        console.log(`[Key Rotation] Migrating ${migrationPromises.length} diary entries for user ${req.user._id}`);
        // Background save
        Promise.all(migrationPromises).catch(e => console.error("Background Diary Migration Error:", e));
    }

    (res as any).status(200).json(decryptedEntries);
  } catch (error) {
    console.error("GET Diary Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

export const createDiaryEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const { title, content, tags, date, moodKeywords } = (req as any).body;
    
    if (!content) return (res as any).status(400).json({ message: 'Content is required.' });
    if (!date) return (res as any).status(400).json({ message: 'Date is required.' }); // STRICT CHECK
    
    const finalTitle = title || "Untitled"; 
    const encTitle = encrypt(finalTitle);
    const encContent = encrypt(content);
    
    const targetDate = new Date(date);
    // Use UTC methods to ensure consistent day boundaries regardless of server timezone
    const startOfDay = new Date(targetDate); startOfDay.setUTCHours(0,0,0,0);
    const endOfDay = new Date(targetDate); endOfDay.setUTCHours(23,59,59,999);

    console.log(`[Diary] Saving entry for User ${req.user._id} at ${targetDate.toISOString()} (Range: ${startOfDay.toISOString()} - ${endOfDay.toISOString()})`);

    // QUERY: Check for entryDate OR createdAt (legacy fallback) in range
    // But for writes, we prioritize entryDate.
    const query = {
        user: req.user._id,
        $or: [
            { entryDate: { $gte: startOfDay, $lte: endOfDay } },
            // If entryDate missing, check createdAt (legacy)
            { entryDate: { $exists: false }, createdAt: { $gte: startOfDay, $lte: endOfDay } }
        ]
    };

    const updatedEntry = await Diary.findOneAndUpdate(
      query,
      {
        $set: {
            title: encTitle,
            content: encContent,
            tags: tags || [],
            moodKeywords: moodKeywords || "",
            entryDate: targetDate // Explicitly save the logic date
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    (res as any).status(201).json({
        ...updatedEntry.toObject(),
        title: finalTitle,
        content: content,
        moodKeywords: moodKeywords
    });
  } catch (error) {
    console.error("POST Diary Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

export const deleteDiaryEntry = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { id } = (req as any).params;
        await Diary.findOneAndDelete({ _id: id, user: req.user._id });
        (res as any).json({ message: 'Deleted' });
    } catch (e) { (res as any).status(500).json({ message: 'Error' }); }
};


// --- MOOD CONTROLLERS ---

export const getMoods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    
    const moods = await Mood.find({ user: req.user._id }).sort({ timestamp: 1 });
    
    const decryptedMoods = moods.map(m => ({
        ...m.toObject(),
        mood: decrypt(m.mood) 
    }));

    (res as any).status(200).json(decryptedMoods);
  } catch (error) {
    console.error("GET Moods Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

export const createMood = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const { mood, score } = (req as any).body;
    
    if (!mood) return (res as any).status(400).json({ message: 'Mood required' });

    const encryptedMood = encrypt(mood);

    const newEntry = await Mood.create({
        user: req.user._id,
        mood: encryptedMood, 
        score: score || 5,
        timestamp: new Date()
    });
    
    (res as any).status(201).json({
        ...newEntry.toObject(),
        mood: mood 
    });

  } catch (error) {
    console.error("POST Mood Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

// --- VIDEO SEARCH CONTROLLER (TUNED FOR SONGS) ---

export const searchVideos = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const { q } = req.query;

    if (!q) return (res as any).json([]);

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.error("YOUTUBE_API_KEY is missing.");
        return (res as any).json([]);
    }

    // Call YouTube Data API
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
            part: 'snippet',
            q: q,
            type: 'video',
            videoCategoryId: '10', // <--- THIS ID (10) FILTERS FOR MUSIC
            key: apiKey,
            maxResults: 15
        }
    });

    const videos = response.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url
    }));

    (res as any).json(videos);

  } catch (error) {
    console.error("Search Video Error:", error);
    (res as any).json([]);
  }
};

// --- DETECTIVE WEB CONTROLLERS ---

export const getDetectiveWeb = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const web = await detectiveService.getWeb(req.user._id);
        (res as any).json(web);
    } catch (e) {
        console.error("Get Web Error:", e);
        (res as any).status(500).json({ message: 'Error fetching web' });
    }
};

export const triggerRetroScan = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

        // Run in background (don't await fully if it takes long, but for now we await to see result)
        const result = await detectiveService.runRetroactiveScan(req.user._id);
        (res as any).json(result);
    } catch (e) {
        console.error("Scan Error:", e);
        (res as any).status(500).json({ message: 'Scan failed' });
    }
};

// --- MUGSHOT UPLOAD CONTROLLER ---
export const updateMugshot = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

        const { personId, image } = (req as any).body;
        if (!personId || !image) return (res as any).status(400).json({ message: 'Missing Data' });

        const person = await Person.findOneAndUpdate(
            { _id: personId, userId: req.user._id },
            { mugshot: image }, // Base64 string storage
            { new: true }
        );

        if (!person) return (res as any).status(404).json({ message: 'Person not found' });

        (res as any).json(person);
    } catch (e) {
        console.error("Mugshot Error:", e);
        (res as any).status(500).json({ message: 'Upload failed' });
    }
};
