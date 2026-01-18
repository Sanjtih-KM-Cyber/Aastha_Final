import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        throw new Error('Server misconfiguration: Missing JWT_SECRET');
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-passwordHash');
      
      if (!user) {
          return (res as any).status(401).json({ message: 'Not authorized' });
      }

      // --- EMPIRE BUSINESS LOGIC: DAILY RESET & EXPIRY ---
      const now = new Date();
      let needsSave = false;

      // 1. Daily Reset Logic (The Reset)
      const lastUsage = new Date(user.lastUsageDate || user.createdAt || Date.now());
      if (lastUsage.getDate() !== now.getDate() ||
          lastUsage.getMonth() !== now.getMonth() ||
          lastUsage.getFullYear() !== now.getFullYear()) {

          user.dailyPremiumUsage = 0;
          user.voiceHugs = { count: 0, lastReset: now }; // Reset Voice Hugs
          if (user.cloneMode) {
             user.cloneMode.usageCount = 0; // Reset Clone Mode
          }
          user.lastUsageDate = now;
          needsSave = true;
      }

      // 2. Subscription Expiry (The Gate)
      if (user.isPro && user.subscriptionDate) {
          const subDate = new Date(user.subscriptionDate);
          // Calculate difference in milliseconds
          const diffTime = now.getTime() - subDate.getTime();
          // Convert to days
          const diffDays = diffTime / (1000 * 3600 * 24);

          if (diffDays > 30) {
              console.log(`[Empire] User ${user._id} subscription expired (${diffDays.toFixed(1)} days). Revoking Pro.`);
              user.isPro = false;
              // We do NOT reset dailyPremiumUsage here, so they instantly hit the wall if they've used it.
              needsSave = true;
          }
      }

      if (needsSave) {
          await user.save();
      }
      // ---------------------------------------------------

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      (res as any).status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    (res as any).status(401).json({ message: 'Not authorized, no token' });
  }
};
