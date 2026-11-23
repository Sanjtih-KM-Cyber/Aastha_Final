import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPublicKey, isValidSubscription, addSubscription, removeSubscription, sendToUser } from '../services/webPush';

// GET /api/users/push/key  (public)
export const getPushKey = (_req: Request, res: Response) => {
  const key = getPublicKey();
  if (!key) return (res as any).status(503).json({ message: 'Push notifications are not configured yet.' });
  (res as any).json({ publicKey: key });
};

// POST /api/users/push/subscribe  { subscription }
export const subscribePush = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const sub = (req as any).body?.subscription;
  if (!isValidSubscription(sub)) return (res as any).status(400).json({ message: 'Invalid subscription' });
  await addSubscription(req.user._id.toString(), sub, (req.headers['user-agent'] as string) || '');
  (res as any).json({ success: true });
};

// POST /api/users/push/unsubscribe  { endpoint }
export const unsubscribePush = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const endpoint = (req as any).body?.endpoint;
  if (typeof endpoint !== 'string') return (res as any).status(400).json({ message: 'endpoint required' });
  await removeSubscription(req.user._id.toString(), endpoint);
  (res as any).json({ success: true });
};

// POST /api/users/push/test — lets the user confirm notifications work on this device
export const testPush = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const sent = await sendToUser(req.user._id.toString(), {
    title: 'Notifications are on 🌸',
    body: "This is how I'll check in — gently, and not too often.",
    tag: 'aastha-test',
  });
  (res as any).json({ success: sent > 0, delivered: sent });
};
