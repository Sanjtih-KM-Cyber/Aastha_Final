/**
 * Diary "forgot password", reworked.
 *
 * Diary entries are encrypted with the account's master key (unlocked by the ACCOUNT password at login)
 * and again at rest with the server key. The diary password is only a lock in front of them, so a reset
 * can KEEP every entry. (The old flow deleted the whole diary, verified nothing on the server, and its
 * "recovery" step called the account-reset endpoint, so it never even showed the security question.)
 *
 * Verification (server-side, all methods share one lockout: 5 wrong tries → 15 min):
 *   - account_password : the user's login password
 *   - security_answer  : answer to their security question
 *   - email_code       : 6-digit code sent by POST /diary/reset-code (10 min validity)
 */
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Diary from '../models/Diary';
import { decrypt } from '../utils/serverEncryption';
import { sendOTPEmail } from '../services/emailService';

export const MAX_DIARY_RESET_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;
const CODE_TTL_MS = 10 * 60_000;
const MIN_DIARY_PASSWORD = 4;

type Method = 'account_password' | 'security_answer' | 'email_code';

const loadUser = (id: any) =>
  User.findById(id).select('+passwordHash +diaryReset.codeHash');

const lockedMessage = (until: Date) =>
  `Too many attempts. Try again after ${new Date(until).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.`;

/** Verifies the chosen method. Returns null when OK, or { status, message }. Tracks attempts + lockout. */
const verify = async (user: any, method: Method, secret: string): Promise<{ status: number; message: string } | null> => {
  const r = user.diaryReset || {};
  if (r.lockedUntil && new Date(r.lockedUntil) > new Date()) return { status: 429, message: lockedMessage(r.lockedUntil) };
  if (typeof secret !== 'string' || !secret.trim()) return { status: 400, message: 'Please fill in the verification field.' };

  let ok = false;
  if (method === 'account_password') {
    ok = !!user.passwordHash && (await bcrypt.compare(secret, user.passwordHash));
  } else if (method === 'security_answer') {
    const hash = user.securityQuestions?.[0]?.answerHash;
    if (!hash) return { status: 400, message: 'No security question is set on this account. Try another method.' };
    ok = await bcrypt.compare(secret.toLowerCase().trim(), hash);
  } else if (method === 'email_code') {
    if (!r.codeHash || !r.expires || new Date(r.expires) < new Date()) return { status: 400, message: 'That code has expired. Request a new one.' };
    ok = await bcrypt.compare(secret.trim(), r.codeHash);
  } else {
    return { status: 400, message: 'Choose a way to verify it’s you.' };
  }

  if (!ok) {
    const attempts = (r.attempts || 0) + 1;
    const update: any = { 'diaryReset.attempts': attempts };
    if (attempts >= MAX_DIARY_RESET_ATTEMPTS) {
      update['diaryReset.lockedUntil'] = new Date(Date.now() + LOCK_MS);
      update['diaryReset.attempts'] = 0;
    }
    await User.updateOne({ _id: user._id }, { $set: update });
    return attempts >= MAX_DIARY_RESET_ATTEMPTS
      ? { status: 429, message: lockedMessage(update['diaryReset.lockedUntil']) }
      : { status: 401, message: "That didn't match. Please try again." };
  }
  return null;
};

const clearResetState = (userId: any) =>
  User.updateOne({ _id: userId }, { $set: { 'diaryReset.attempts': 0 }, $unset: { 'diaryReset.codeHash': 1, 'diaryReset.expires': 1, 'diaryReset.lockedUntil': 1 } });

// GET /api/users/diary/reset-options, what the user can verify with
export const getDiaryResetOptions = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const user: any = await User.findById(req.user._id);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  const email = decrypt(user.emailEncrypted || '');
  (res as any).json({
    question: user.securityQuestions?.[0]?.question || null,
    canEmail: !!process.env.RESEND_API_KEY && !!email,
    emailHint: email ? email.replace(/^(.).*?(@.*)$/, '$1•••$2') : null,
    lockedUntil: user.diaryReset?.lockedUntil && new Date(user.diaryReset.lockedUntil) > new Date() ? user.diaryReset.lockedUntil : null,
  });
};

// POST /api/users/diary/reset-code, emails a 6-digit code
export const sendDiaryResetCode = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const user: any = await User.findById(req.user._id);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  if (user.diaryReset?.lockedUntil && new Date(user.diaryReset.lockedUntil) > new Date()) {
    return (res as any).status(429).json({ message: lockedMessage(user.diaryReset.lockedUntil) });
  }
  const email = decrypt(user.emailEncrypted || '');
  if (!email) return (res as any).status(400).json({ message: 'No email on this account.' });
  const code = crypto.randomInt(100000, 1000000).toString();
  await User.updateOne({ _id: user._id }, { $set: { 'diaryReset.codeHash': await bcrypt.hash(code, 8), 'diaryReset.expires': new Date(Date.now() + CODE_TTL_MS) } });
  const sent = await sendOTPEmail(email, code, 'diary');
  if (sent === false && process.env.RESEND_API_KEY) return (res as any).status(503).json({ message: "Couldn't send the email right now. Try another method." });
  (res as any).json({ success: true, message: 'Code sent. It expires in 10 minutes.' });
};

const validNewPassword = (p: any) => typeof p === 'string' && p.length >= MIN_DIARY_PASSWORD && p.length <= 128;

// POST /api/users/diary/reset-password { method, secret, newPassword }, entries are KEPT
export const resetDiaryPassword = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { method, secret, newPassword } = (req as any).body || {};
  if (!validNewPassword(newPassword)) return (res as any).status(400).json({ message: `Use at least ${MIN_DIARY_PASSWORD} characters.` });
  const user: any = await loadUser(req.user._id);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });

  const fail = await verify(user, method, secret);
  if (fail) return (res as any).status(fail.status).json({ message: fail.message });

  await User.updateOne({ _id: user._id }, { $set: { diaryPasswordHash: await bcrypt.hash(newPassword, 10) } });
  await clearResetState(user._id);
  const entries = await Diary.countDocuments({ user: user._id });
  (res as any).json({ success: true, entriesKept: entries, message: 'Diary password changed. All your entries are still there.' });
};

// POST /api/users/diary/start-fresh { method, secret, newPassword }, deliberate, verified wipe
export const startFreshDiary = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { method, secret, newPassword } = (req as any).body || {};
  if (!validNewPassword(newPassword)) return (res as any).status(400).json({ message: `Use at least ${MIN_DIARY_PASSWORD} characters.` });
  const user: any = await loadUser(req.user._id);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });

  const fail = await verify(user, method, secret);
  if (fail) return (res as any).status(fail.status).json({ message: fail.message });

  const { deletedCount } = await Diary.deleteMany({ user: user._id });
  await User.updateOne({ _id: user._id }, { $set: { diaryPasswordHash: await bcrypt.hash(newPassword, 10) } });
  await clearResetState(user._id);
  (res as any).json({ success: true, entriesDeleted: deletedCount, message: 'Your diary has been cleared and the new password is set.' });
};
