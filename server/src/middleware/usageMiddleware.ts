import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import User from '../models/User';

export const checkUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return (res as any).status(401).json({ message: 'Unauthorized' });
        }

        // 1. Fetch latest user state (avoid stale data)
        const user = await User.findById(req.user._id);
        if (!user) {
            return (res as any).status(404).json({ message: 'User not found' });
        }

        // 2. Check Time Logic (IST Midnight, UTC+5:30)
        // We shift both dates by 5.5 hours to align "Same Day" with IST
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const now = new Date();
        const lastDate = user.lastMessageDate || new Date(0); // Default to epoch if missing

        const nowIST = new Date(now.getTime() + IST_OFFSET);
        const lastDateIST = new Date(lastDate.getTime() + IST_OFFSET);

        const isSameDay =
            nowIST.getUTCFullYear() === lastDateIST.getUTCFullYear() &&
            nowIST.getUTCMonth() === lastDateIST.getUTCMonth() &&
            nowIST.getUTCDate() === lastDateIST.getUTCDate();

        if (!isSameDay) {
            // Reset for new day - Split Quotas
            user.dailyGeminiCount = 0;
            user.dailyGroqCount = 0;
            user.dailyMessageCount = 0; // <--- RESET
            user.dailyVoiceCount = 0; // <--- RESET
            user.lastMessageDate = now;

            // Force persistence
            user.markModified('dailyMessageCount');
            user.markModified('dailyVoiceCount');

            await user.save();
        }

        // NOTE: We do NOT enforce limits here anymore.
        // The "Quota Waterfall" logic happens in the chatController to decide ROUTING.
        // This middleware strictly handles the Daily Reset trigger.

        // 3. Update req.user so controllers have latest data
        req.user = user;

        next();

    } catch (error) {
        console.error("Usage Middleware Error:", error);
        return (res as any).status(500).json({ message: "Server usage check failed." });
    }
};
