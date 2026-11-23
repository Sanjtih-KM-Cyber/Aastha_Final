import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

/**
 * Daily quota resets now happen once, in `protect` (utils/dailyReset.ts, rolling 24 h window).
 * This middleware previously re-fetched the user and ran a second, differently-timed reset (ROADMAP R8).
 * Quota *enforcement/routing* lives in chatController ("quota waterfall").
 * Kept as a hook so routes don't change.
 */
export const checkUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return (res as any).status(401).json({ message: 'Unauthorized' });
    }
    next();
};
