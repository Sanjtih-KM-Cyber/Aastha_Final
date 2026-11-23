import express from 'express';
import { chatWithAI, getChatHistory, reactToMessage, sendNudge } from '../controllers/chatController';
import { protect } from '../middleware/authMiddleware';
import { checkUsage } from '../middleware/usageMiddleware';

const router = express.Router();

router.post('/', protect as any, checkUsage as any, chatWithAI as any);
router.get('/history', protect as any, getChatHistory as any);
router.post('/react', protect as any, reactToMessage as any);
router.post('/nudge', protect as any, sendNudge as any); // follow-up after a reaction / left on seen (no quota)

export default router;