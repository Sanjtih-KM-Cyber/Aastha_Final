/**
 * Custom mood types (owner request 2026-11-23): users add their own moods to the Mood tracker —
 * a name (encrypted: it can be personal, e.g. "missing home"), one emoji and a level 1–10
 * (1 = very heavy, 10 = great; the level feeds the weekly average/insight like built-in moods).
 */
import crypto from 'crypto';
import User from '../models/User';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { isAllowedReaction } from './reactions';

export const MAX_CUSTOM_MOODS = 24;
export const MAX_MOOD_LABEL = 24;

export interface CustomMood { id: string; label: string; emoji: string; score: number }

export const cleanMoodInput = (raw: any): Omit<CustomMood, 'id'> | { error: string } => {
  const label = String(raw?.label ?? '').replace(/<[^>]*>/g, '').replace(/[<>{}\[\]`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_MOOD_LABEL);
  if (label.length < 2) return { error: 'Give your mood a name (2–24 characters).' };
  const emoji = String(raw?.emoji ?? '').trim();
  if (!isAllowedReaction(emoji)) return { error: 'Pick one emoji.' };
  const score = Math.round(Number(raw?.score));
  if (!Number.isFinite(score) || score < 1 || score > 10) return { error: 'Level must be 1–10.' };
  return { label, emoji, score };
};

const toPublic = (m: any): CustomMood => ({ id: String(m.id), label: decrypt(m.label || ''), emoji: m.emoji, score: m.score });

export const listCustomMoods = async (userId: any): Promise<CustomMood[]> => {
  const u: any = await User.findById(userId).select('customMoods').lean();
  return (u?.customMoods || []).map(toPublic);
};

export const addCustomMood = async (userId: any, raw: any): Promise<{ mood?: CustomMood; error?: string; status: number }> => {
  const clean = cleanMoodInput(raw);
  if ('error' in clean) return { error: clean.error, status: 400 };
  const existing = await listCustomMoods(userId);
  if (existing.length >= MAX_CUSTOM_MOODS) return { error: `You can have up to ${MAX_CUSTOM_MOODS} custom moods.`, status: 400 };
  if (existing.some((m) => m.label.toLowerCase() === clean.label.toLowerCase())) return { error: 'You already have a mood with that name.', status: 409 };
  const doc = { id: crypto.randomUUID(), label: encrypt(clean.label), emoji: clean.emoji, score: clean.score };
  await User.updateOne({ _id: userId }, { $push: { customMoods: doc } });
  return { mood: toPublic(doc), status: 201 };
};

export const deleteCustomMood = async (userId: any, id: string) => {
  const r = await User.updateOne({ _id: userId }, { $pull: { customMoods: { id: String(id) } } });
  return r.modifiedCount === 1;
};
