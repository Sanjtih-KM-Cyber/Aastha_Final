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
            // Reset for new day
            user.dailyMessageCount = 0;
            user.lastMessageDate = now;
            // Note: We don't save yet, we save after incrementing below
        }

        // 3. Define Limits
        const FREE_LIMIT = 10;
        const PRO_LIMIT = 100;

        // Check Pro Status (including active subscription or top-up)
        // Note: voiceTopUp doesn't grant unlimited text messages, only Voice Mode.
        // But the requirement says "Pro Users" get 100.
        // If user.isPro is true, they get 100.
        // If user has valid subscriptionExpiresAt, check that too.
        let isPro = user.isPro;
        if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
            isPro = true;
        }

        const limit = isPro ? PRO_LIMIT : FREE_LIMIT;

        // 4. Enforce Limit
        if (user.dailyMessageCount >= limit) {
            const isFreeUser = !isPro;
            const message = isFreeUser
                ? "Daily energy depleted. Upgrade for more or come back tomorrow."
                : "Daily energy depleted. Even AI needs to sleep. Come back tomorrow.";

            return (res as any).status(429).json({
                message: message,
                meta: { limitReached: true }
            });
        }

        // 5. Increment and Save
        user.dailyMessageCount += 1;
        user.lastMessageDate = now;
        await user.save();

        // 6. Update req.user so controllers have latest data
        req.user = user;

        next();

    } catch (error) {
        console.error("Usage Middleware Error:", error);
        // Fail open? Or fail closed?
        // Safety: Fail closed (500) to prevent abuse if DB is down,
        // but for user experience, maybe just log and proceed?
        // Requirement says "Strict", so fail closed.
        return (res as any).status(500).json({ message: "Server usage check failed." });
    }
};
