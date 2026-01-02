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

      // --- FIX: CHECK PREMIUM EXPIRY (30 DAYS) ---
      if (user.isPro && user.subscriptionDate) {
          const now = new Date();
          const subDate = new Date(user.subscriptionDate);
          const diffTime = Math.abs(now.getTime() - subDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

          if (diffDays > 30) {
              console.log(`User ${user._id} subscription expired (${diffDays} days). Revoking Pro.`);
              user.isPro = false;
              user.dailyPremiumUsage = 0; // Reset usage logic to standard
              await user.save();
          }
      }
      // -------------------------------------------

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      (res as any).status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    (res as any).status(401).json({ message: 'Not authorized, no token' });
  }
};
