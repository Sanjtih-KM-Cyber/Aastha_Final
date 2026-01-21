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

        // 2. Check Time Logic (UTC Midnight)
        const now = new Date();
        const lastDate = user.lastMessageDate || new Date(0); // Default to epoch if missing

        const isSameDay =
            now.getUTCFullYear() === lastDate.getUTCFullYear() &&
            now.getUTCMonth() === lastDate.getUTCMonth() &&
            now.getUTCDate() === lastDate.getUTCDate();

        if (!isSameDay) {
            // Reset for new day - Split Quotas
            user.dailyGeminiCount = 0;
            user.dailyGroqCount = 0;
            user.lastMessageDate = now;
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
