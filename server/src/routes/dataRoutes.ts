import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { 
  getDiaryEntries, 
  createDiaryEntry, 
  deleteDiaryEntry,
  getMoods, 
  createMood,
  searchVideos,
  getDetectiveWeb, // New
  triggerRetroScan // New
} from '../controllers/dataController';

const router = express.Router();

// Diary Routes
router.get('/diary', protect as any, getDiaryEntries as any);
router.post('/diary', protect as any, createDiaryEntry as any);
router.delete('/diary/:id', protect as any, deleteDiaryEntry as any);

// Mood Routes
router.get('/moods', protect as any, getMoods as any);
router.post('/moods', protect as any, createMood as any);

// Video Routes
router.get('/videos/search', protect as any, searchVideos as any);

// Detective Web Routes
router.get('/web', protect as any, getDetectiveWeb as any);
router.post('/web/scan', protect as any, triggerRetroScan as any);

export default router;
