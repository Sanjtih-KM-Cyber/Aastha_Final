import express from 'express';
import { chatWithAI, getChatHistory } from '../controllers/chatController';
import { protect } from '../middleware/authMiddleware';
import { checkUsage } from '../middleware/usageMiddleware';

const router = express.Router();

router.post('/', protect as any, checkUsage as any, chatWithAI as any);
router.get('/history', protect as any, getChatHistory as any);

export default router;