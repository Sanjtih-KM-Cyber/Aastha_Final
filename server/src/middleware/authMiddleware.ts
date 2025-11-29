import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

// Extend Express Request to include User
export interface AuthRequest extends Request {
  user?: any;
}

interface DecodedToken {
  id: string;
  iat: number;
  exp: number;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if ((req as any).cookies && (req as any).cookies.jwt) {
    token = (req as any).cookies.jwt;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as DecodedToken;
      
      // Attach user to request object
      const user = await User.findById(decoded.id).select('-passwordHash');
      
      if (!user) {
        (res as any).status(401).json({ message: 'Not authorized, user not found' });
        return;
      }

      req.user = user;
      // Fix: Cast next to any to ensure it's callable despite strict type check issues
      (next as any)();
    } catch (error) {
      console.error(error);
      (res as any).status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    (res as any).status(401).json({ message: 'Not authorized, no token' });
  }
};