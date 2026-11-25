import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Diary from '../models/Diary';
import Mood from '../models/Mood';
import { searchYouTube } from '../services/youtubeSearch';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { detectiveService, MAX_MUGSHOT_CHARS } from '../services/detectiveService';
import mongoose from 'mongoose';

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

        // Safe Mode for Title
        if (originalTitle.includes(':') && decryptedTitle === originalTitle) {
             console.warn(`[Safe Mode] Title decryption failed for diary ${entry._id}`);
             // Don't save, just return placeholder logic if needed or keep original in DB but display error
             // We'll keep DB as is to avoid corruption
        } else {
            const reEncryptedTitle = encrypt(decryptedTitle);
            if (originalTitle !== reEncryptedTitle) {
                entry.title = reEncryptedTitle;
                needsSave = true;
            }
        }

        const originalContent = entry.content;
        const decryptedContent = decrypt(originalContent);

        // Safe Mode for Content
        if (originalContent.includes(':') && decryptedContent === originalContent) {
             console.warn(`[Safe Mode] Content decryption failed for diary ${entry._id}`);
        } else {
            const reEncryptedContent = encrypt(decryptedContent);
            if (originalContent !== reEncryptedContent) {
                entry.content = reEncryptedContent;
                needsSave = true;
            }
        }

        if (needsSave) {
            migrationPromises.push(entry.save());
        }

        return {
            ...entry.toObject(),
            title: (originalTitle.includes(':') && decryptedTitle === originalTitle) ? "[Locked]" : decryptedTitle,
            content: (originalContent.includes(':') && decryptedContent === originalContent) ? "[Locked]" : decryptedContent,
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
            moodKeywords: moodKeywords ? encrypt(String(moodKeywords).slice(0, 200)) : "", // encrypted (S13)
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
    const { mood, score, timestamp, createdAt } = (req as any).body;
    
    if (!mood) return (res as any).status(400).json({ message: 'Mood required' });

    const encryptedMood = encrypt(mood);

    // Accept timestamp from client (for offline sync) or default to now
    const dateToSave = timestamp || createdAt ? new Date(timestamp || createdAt) : new Date();

    const newEntry = await Mood.create({
        user: req.user._id,
        mood: encryptedMood, 
        score: score || 5,
        timestamp: dateToSave
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

    // Cached + quota-protected (services/youtubeSearch.ts, A11)
    const videos = await searchYouTube(String(q), { max: 15, musicOnly: true, songsOnly: true }); // no Shorts / live streams

    (res as any).json(videos);

  } catch (error) {
    console.error("Search Video Error:", error);
    (res as any).json([]);
  }
};

// POST /api/data/videos/batch { songs: ["Song - Artist", ...] } → one real song per title, in the order asked
// (owner, 2026-11-25: "if I ask for many songs in one go, make a playlist of exactly those"). Max 12: every
// uncached title is one YouTube search (100 of 10,000 daily quota units).
export const MAX_BATCH_SONGS = 12;
export const searchSongBatch = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const raw = (req as any).body?.songs;
  const titles: string[] = (Array.isArray(raw) ? raw : [])
    .map((t: any) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean)
    .filter((t: string, i: number, a: string[]) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, MAX_BATCH_SONGS);
  if (!titles.length) return (res as any).status(400).json({ message: 'No songs given.' });
  try {
    const found = await Promise.all(titles.map((t) => searchYouTube(`${t} audio`, { max: 1, songsOnly: true }).then((r) => r[0] || null).catch(() => null)));
    const seen = new Set<string>();
    const tracks = found.filter((t): t is NonNullable<typeof t> => !!t && !seen.has(t.id) && !!seen.add(t.id));
    const missing = titles.filter((_, i) => !found[i]);
    (res as any).json({ tracks, missing });
  } catch (e: any) {
    console.error('Song batch error:', e?.message || e);
    (res as any).status(503).json({ message: "Couldn't find those songs right now." });
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
        if (typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(image) || image.length > MAX_MUGSHOT_CHARS) {
            return (res as any).status(400).json({ message: 'Please upload a PNG/JPEG/WebP image under ~1.8 MB.' });
        }
        if (!mongoose.isValidObjectId(personId)) return (res as any).status(400).json({ message: 'Invalid person' });

        // Stored encrypted (third-party photo), S7
        const person = await detectiveService.setMugshot(req.user._id, personId, image);

        if (!person) return (res as any).status(404).json({ message: 'Person not found' });

        (res as any).json(person);
    } catch (e) {
        console.error("Mugshot Error:", e);
        (res as any).status(500).json({ message: 'Upload failed' });
    }
};


// PUT /api/data/web/:id { role?, roleLabel?, vibe? }, the user corrects the AI's classification
export const updatePersonClassification = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const id = String((req as any).params?.id || '');
        if (!mongoose.isValidObjectId(id)) return (res as any).status(400).json({ message: 'Invalid id' });
        const { role, roleLabel, vibe } = (req as any).body || {};
        const person = await detectiveService.setClassification(String(req.user._id), id, { role, roleLabel, vibe });
        if (!person) return (res as any).status(404).json({ message: 'Not found' });
        (res as any).json(person);
    } catch (e) {
        console.error('Update person failed:', e);
        (res as any).status(500).json({ message: 'Could not update' });
    }
};
