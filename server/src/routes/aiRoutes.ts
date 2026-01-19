import express from 'express';
import { generateTheme, recommendMusic, analyzeDiary, analyzeChat, generateVibePlaylist } from '../controllers/aiController';
import { getAudio } from '../controllers/audioController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/theme', protect as any, generateTheme as any);
router.post('/music', protect as any, recommendMusic as any);
router.get('/analyze/diary', protect as any, analyzeDiary as any);
router.get('/analyze/chat', protect as any, analyzeChat as any);

// NEW ROUTE
router.post('/generate-vibe', protect as any, generateVibePlaylist as any);

// AUDIO PROXY (No auth needed for streaming src, or use token in query param if strict. For now, public via ID is fine as IDs are UUIDs)
router.get('/stream/:id', getAudio as any);

export default router;