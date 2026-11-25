import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { 
  getDiaryEntry,
  createDiaryEntry, 
  deleteDiaryEntry,
  getMoods, 
  createMood,
  searchVideos,
  searchSongBatch,
  getDetectiveWeb, // New
  triggerRetroScan, // New
  updateMugshot, // New Mugshot Upload
  updatePersonClassification
} from '../controllers/dataController';
import { moodInsights, getCustomMoods, createCustomMood, removeCustomMood } from '../controllers/meController';

const router = express.Router();

// Diary Routes
router.get('/diary', protect as any, getDiaryEntry as any);
router.post('/diary', protect as any, createDiaryEntry as any);
router.delete('/diary/:id', protect as any, deleteDiaryEntry as any);

// Mood Routes
router.get('/moods', protect as any, getMoods as any);
router.get('/moods/insights', protect as any, moodInsights as any);
router.get('/moods/custom', protect as any, getCustomMoods as any);
router.post('/moods/custom', protect as any, createCustomMood as any);
router.delete('/moods/custom/:id', protect as any, removeCustomMood as any);
router.post('/moods', protect as any, createMood as any);

// Video Routes
router.get('/videos/search', protect as any, searchVideos as any);
router.post('/videos/batch', protect as any, searchSongBatch as any); // several requested songs → one playlist

// Detective Web Routes
router.get('/web', protect as any, getDetectiveWeb as any);
router.post('/web/scan', protect as any, triggerRetroScan as any);
router.post('/web/mugshot', protect as any, updateMugshot as any); // New
router.put('/web/:id', protect as any, updatePersonClassification as any);

export default router;
