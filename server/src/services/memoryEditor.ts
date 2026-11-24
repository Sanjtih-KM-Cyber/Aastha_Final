/**
 * "What Aastha remembers" (owner, 2026-11-24): the user can see, edit and delete what Aastha has learned.
 *  - facts:      short things they told her (encrypted strings, ≤ 40)
 *  - summary:    her running note about how they've been (encrypted, ≤ 120 words from the model)
 *  - follow-ups: dated things she may check in about (encrypted text)
 *
 * Two guarantees:
 *  1. An edit is never undone by the background memory updater (services/memoryService.ts): every edit stamps
 *     `memoryEditedAt`, and the updater only writes if that stamp didn't change while it was thinking.
 *  2. A deleted fact stays deleted: its blind-index fingerprint goes into `forgottenFacts`, and the updater
 *     drops any new fact with the same fingerprint (normalised text, so "Loves chai." = "loves chai").
 */
import User from '../models/User';
import { encrypt, decrypt, blindIndex } from '../utils/serverEncryption';

export const MAX_FACT_LEN = 160;
export const MAX_SUMMARY_LEN = 1200;
const MAX_FORGOTTEN = 200;

const normFact = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();
export const factFingerprint = (s: string) => blindIndex(normFact(s));

export const readMemory = async (userId: any) => {
  const u: any = await User.findById(userId).select('facts memorySummary followUps').lean();
  if (!u) return null;
  return {
    summary: decrypt(u.memorySummary || ''),
    facts: (u.facts || []).map((f: string, i: number) => ({ i, text: decrypt(f) })).filter((f: any) => f.text),
    followUps: (u.followUps || [])
      .filter((f: any) => f.status === 'pending' || f.status === 'asked')
      .map((f: any) => ({ id: String(f._id), text: decrypt(f.text || ''), dueDate: f.dueDate, status: f.status }))
      .sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate)),
  };
};

export type EditResult = 'ok' | 'not_found' | 'changed' | 'invalid';

/**
 * Edit (text) or delete (text = null/'') one fact. `original` is the text the user saw, so a fact that moved or
 * changed in the meantime is never overwritten by mistake ('changed' → the app reloads the list).
 */
export const editFact = async (userId: any, index: number, original: string, text: string | null): Promise<EditResult> => {
  if (!Number.isInteger(index) || index < 0) return 'invalid';
  const u: any = await User.findById(userId).select('facts');
  if (!u) return 'not_found';
  const facts: string[] = u.facts || [];
  if (index >= facts.length) return 'changed';
  const current = decrypt(facts[index]);
  if (normFact(current) !== normFact(original)) return 'changed';

  const next = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_LEN);
  const update: any = { $set: { memoryEditedAt: new Date() } };
  if (!next) {
    const copy = [...facts]; copy.splice(index, 1);
    update.$set.facts = copy;
    update.$push = { forgottenFacts: { $each: [factFingerprint(current)], $slice: -MAX_FORGOTTEN } };
  } else {
    const copy = [...facts]; copy[index] = encrypt(next);
    update.$set.facts = copy;
    // the old wording was wrong → don't re-learn it
    if (normFact(next) !== normFact(current)) update.$push = { forgottenFacts: { $each: [factFingerprint(current)], $slice: -MAX_FORGOTTEN } };
  }
  // only if nobody (the memory updater) rewrote the list meanwhile
  const r = await User.updateOne({ _id: userId, facts }, update);
  return r.modifiedCount ? 'ok' : 'changed';
};

export const setSummary = async (userId: any, text: string): Promise<EditResult> => {
  const t = String(text ?? '').trim().slice(0, MAX_SUMMARY_LEN);
  await User.updateOne({ _id: userId }, { $set: { memorySummary: t ? encrypt(t) : '', memoryEditedAt: new Date() } });
  return 'ok';
};

/** "Don't ask me about this": the follow-up is dismissed (no check-in, not mentioned in chat). */
export const dismissFollowUp = async (userId: any, id: string): Promise<EditResult> => {
  if (!/^[0-9a-f]{24}$/i.test(id)) return 'invalid';
  const r = await User.updateOne({ _id: userId, 'followUps._id': id }, { $set: { 'followUps.$.status': 'dismissed', memoryEditedAt: new Date() } });
  return r.matchedCount ? 'ok' : 'not_found';
};

/** For the memory updater: drop facts the user deleted before. */
export const withoutForgotten = (facts: string[], forgotten: string[] = []) => {
  if (!forgotten.length) return facts;
  const set = new Set(forgotten);
  return facts.filter((f) => !set.has(factFingerprint(f)));
};
