import express from 'express';
import { generateTheme, recommendMusic, analyzeDiary, analyzeChat, generateVibePlaylist } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/theme', protect as any, generateTheme as any);
router.post('/music', protect as any, recommendMusic as any);
router.get('/analyze/diary', protect as any, analyzeDiary as any);
router.get('/analyze/chat', protect as any, analyzeChat as any);

// NEW ROUTE
router.post('/generate-vibe', protect as any, generateVibePlaylist as any);

export default router;