import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/jwtKeys';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { applyDailyReset } from '../utils/dailyReset';
import { cleanTimeZone } from '../utils/timeZone';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  // PRIORITY 1: Check Cookies (Secure Web Flow)
  if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
  }
  // PRIORITY 2: Check Header (Mobile/API Flow)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('Server misconfiguration: Missing JWT_SECRET');
      }

      const decoded: any = verifyJwt(token);

      // Special-purpose tokens (e.g. 'reset-verified', issued after the reset OTP but BEFORE the
      // security answer) must never work as login sessions.
      if (decoded.purpose) {
          return (res as any).status(401).json({ message: 'Not authorized' });
      }

      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
          return (res as any).status(401).json({ message: 'Not authorized' });
      }

      // Revocation: tokens issued before the last tokenVersion bump (password reset, "log out everywhere")
      // are rejected. Legacy tokens without `tv` count as version 0.
      if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
          return (res as any).status(401).json({ message: 'Session expired. Please log in again.' });
      }

      // --- EMPIRE BUSINESS LOGIC: DAILY RESET & EXPIRY ---
      const now = new Date();
      let needsSave = false;

      // 1. Daily Reset Logic (The Reset)
      // Rolling 24 h quota window (utils/dailyReset.ts), writes at most once per window (plus on subscription expiry).
      if (applyDailyReset(user, now)) needsSave = true;

      // The app sends its device time zone on every request → streak, check-ins, "today" follow the user's clock
      const tz = cleanTimeZone((req as any).query?._tz || (req as any).headers?.['x-time-zone']);
      if (tz && (user as any).timeZone !== tz) { (user as any).timeZone = tz; needsSave = true; }

      // 2. Subscription Expiry (The Gate)
      // Prefer the explicit expiry (supports stacked renewals); fall back to purchase date + 30 days for legacy users.
      if (user.isPro) {
          const expiresAt = user.subscriptionExpiresAt
              ? new Date(user.subscriptionExpiresAt)
              : user.subscriptionDate
                  ? new Date(new Date(user.subscriptionDate).getTime() + 30 * 24 * 60 * 60 * 1000)
                  : null;

          if (expiresAt && now > expiresAt) {
              console.log(`[Subscription] User ${user._id} Pro expired at ${expiresAt.toISOString()}. Revoking.`);
              user.isPro = false;
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
