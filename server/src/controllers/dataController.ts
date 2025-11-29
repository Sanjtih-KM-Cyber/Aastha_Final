import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Diary from '../models/Diary';
import Mood from '../models/Mood';
import axios from 'axios';
import { encrypt, decrypt } from '../utils/serverEncryption';

// --- Diary Controllers ---

export const getDiaryEntries = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const entries = await Diary.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    const decryptedEntries = entries.map(entry => ({
        ...entry.toObject(),
        title: decrypt(entry.title),
        content: decrypt(entry.content)
    }));

    (res as any).status(200).json(decryptedEntries);
  } catch (error) {
    console.error("GET Diary Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

export const createDiaryEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    const { title, content, tags, date } = (req as any).body;
    
    if (!content) return (res as any).status(400).json({ message: 'Content is required.' });
    
    const finalTitle = title || "Untitled"; 
    // ENCRYPTION HAPPENS HERE BEFORE SAVING
    const encTitle = encrypt(finalTitle);
    const encContent = encrypt(content);
    
    const entryDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(entryDate); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(entryDate); endOfDay.setHours(23,59,59,999);

    const updatedEntry = await Diary.findOneAndUpdate(
      { 
        user: req.user._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      },
      {
        title: encTitle,
        content: encContent,   
        tags: tags || [],
        createdAt: entryDate 
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    (res as any).status(201).json({
        ...updatedEntry.toObject(),
        title: finalTitle,
        content: content
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


// --- MOOD CONTROLLERS (FIXED) ---

export const getMoods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
    
    const moods = await Mood.find({ user: req.user._id }).sort({ timestamp: 1 });
    
    // Decrypt labels for frontend display
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

    // ENCRYPTION HAPPENS HERE
    const encryptedMood = encrypt(mood);

    // FIX: Always CREATE a new entry. Do not update/average.
    // This allows multiple moods per day to be stored distinctively.
    const newEntry = await Mood.create({
        user: req.user._id,
        mood: encryptedMood, // Stored as ciphertext
        score: score || 5,
        timestamp: new Date()
    });
    
    (res as any).status(201).json({
        ...newEntry.toObject(),
        mood: mood // Return plain text to client
    });

  } catch (error) {
    console.error("POST Mood Failed:", error); 
    (res as any).status(500).json({ message: 'Server Error' });
  }
};

export const searchVideos = async (req: AuthRequest, res: Response) => {
    // ... (Keep existing searchVideos)
    (res as any).json([]);
};