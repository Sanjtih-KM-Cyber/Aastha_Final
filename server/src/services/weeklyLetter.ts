/**
 * Weekly letter from Aastha (owner, 2026-11-24).
 *
 * Once a week, after a week you actually chatted (≥ 5 of your messages), Aastha writes you a short, warm letter about
 * your week: what you shared, how you've been, something she noticed, something she's looking forward to. It lands in
 * the chat as a letter card.
 *
 * When: from Sunday 18:00 on YOUR clock until Wednesday (in case the app/server was asleep on Sunday). One per week,
 * claimed atomically (`weeklyLetter.lastWeek` = that Sunday's date), so the cron and the app opening at the same
 * time can't both write one. Never within 48 h of a crisis message. Off switch: Settings → Connection.
 * Triggers: the 15-min cron (web push to the website) and POST /users/letter/check when the app opens (phone
 * notification is a local one the app schedules for Sunday 19:00 from `nextLetterAt`).
 */
import mongoose from 'mongoose';
import User from '../models/User';
import Mood from '../models/Mood';
import MessageModel from '../models/Message';
import { appendMessages } from './messageStore';
import { completeChat } from './llm';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { dayKeyIn, dayNum, hourIn, localAt, tzOrDefault } from '../utils/timeZone';
import { noDashes } from './humanize';
import { PERSONA_VOICE } from '../prompts/companion';
import { broadcast } from './socketService';
import { sendToUser, isWebPushConfigured } from './webPush';

export const LETTER_MIN_MESSAGES = 5;
const LETTER_HOUR = 18;          // Sunday 6 pm on their clock
export const LETTER_NOTIFY_HOUR = 19;
const LATE_DAYS = 3;             // still written Mon to Wed if nobody was around on Sunday
const CRISIS_COOLDOWN_MS = 48 * 3_600_000;

const keyPlus = (key: string, days: number) => new Date((dayNum(key) + days) * 86_400_000).toISOString().slice(0, 10);
const weekdayNum = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = Sunday

/** The Sunday whose letter is due right now, or null (Sun ≥ 18:00 → that Sunday; Mon to Wed → last Sunday). */
export const dueSunday = (now: Date, tz: string): string | null => {
  const today = dayKeyIn(now, tz);
  const w = weekdayNum(today);
  if (w === 0) return hourIn(now, tz) >= LETTER_HOUR ? today : null;
  if (w >= 1 && w <= LATE_DAYS) return keyPlus(today, -w);
  return null;
};

/** The coming Sunday (today if it's Sunday before 18:00). */
export const upcomingSunday = (now: Date, tz: string): string => {
  const today = dayKeyIn(now, tz);
  const w = weekdayNum(today);
  return w === 0 ? today : keyPlus(today, 7 - w);
};

/** Window of the week a letter is about: Monday 00:00 to Sunday 18:00 (their clock). */
const weekWindow = (sunday: string, tz: string) => ({ from: localAt(keyPlus(sunday, -6), 0, tz), to: localAt(sunday, LETTER_HOUR, tz) });

const userMessagesIn = (userId: any, from: Date, to: Date) =>
  MessageModel.countDocuments({ user: userId, role: 'user', timestamp: { $gte: from, $lt: to } });

/** When the phone should show "Aastha wrote you a letter" (null = not expected this week). */
export const nextLetterAt = async (user: any, now = new Date()): Promise<string | null> => {
  if (user?.weeklyLetter?.enabled === false) return null;
  const tz = tzOrDefault(user.timeZone);
  const sunday = upcomingSunday(now, tz);
  if (user.weeklyLetter?.lastWeek === sunday) return null;
  const { from } = weekWindow(sunday, tz);
  if ((await userMessagesIn(user._id, from, now)) < LETTER_MIN_MESSAGES) return null;
  const at = localAt(sunday, LETTER_NOTIFY_HOUR, tz);
  return at > now ? at.toISOString() : null;
};

export type LetterCheck = { letter: { id: string; content: string; timestamp: Date } | null; reason?: string };

/** Writes this week's letter if it's due. Safe to call from the cron and the app at the same time. */
export const maybeWriteLetter = async (userId: any, now = new Date(), opts: { push?: boolean } = {}): Promise<LetterCheck> => {
  const user: any = await User.findById(userId).select('name persona timeZone memorySummary facts weeklyLetter reachOut').lean();
  if (!user) return { letter: null, reason: 'no_user' };
  if (user.weeklyLetter?.enabled === false) return { letter: null, reason: 'off' };
  const tz = tzOrDefault(user.timeZone);
  const sunday = dueSunday(now, tz);
  if (!sunday) return { letter: null, reason: 'not_due' };
  if (user.weeklyLetter?.lastWeek === sunday) return { letter: null, reason: 'already' };
  const lastCrisis = user.reachOut?.lastCrisisAt ? new Date(user.reachOut.lastCrisisAt).getTime() : 0;
  if (now.getTime() - lastCrisis < CRISIS_COOLDOWN_MS) return { letter: null, reason: 'crisis' };
  const { from, to } = weekWindow(sunday, tz);
  if ((await userMessagesIn(user._id, from, to)) < LETTER_MIN_MESSAGES) return { letter: null, reason: 'quiet_week' };

  // Claim the week first (atomic), so two callers can't both write
  const claim = await User.updateOne({ _id: user._id, 'weeklyLetter.lastWeek': { $ne: sunday } }, { $set: { 'weeklyLetter.lastWeek': sunday } });
  if (!claim.modifiedCount) return { letter: null, reason: 'already' };

  try {
    const text = await writeLetter(user, from, to, tz);
    if (!text) throw new Error('empty letter');
    const [saved] = await appendMessages(user._id, [{ role: 'assistant', content: encrypt(text), isLetter: true, timestamp: now }]);
    const letter = { id: String(saved?._id || ''), content: text, timestamp: saved?.timestamp || now };
    broadcast(String(user._id), 'message', { ...letter, role: 'assistant', isLetter: true });
    const bot = user.persona === 'aarav' || user.persona === 'aastik' ? 'Aastik' : 'Aastha';
    if (opts.push && isWebPushConfigured()) {
      // never the letter itself in a notification (it's private and long)
      await sendToUser(String(user._id), { title: `${bot} wrote you a letter 💌`, body: 'About your week. Open when you have a quiet minute.', url: '/sanctuary', tag: 'weekly-letter' }).catch(() => 0);
    }
    return { letter };
  } catch (e: any) {
    // give the week back so the next check can try again
    await User.updateOne({ _id: user._id, 'weeklyLetter.lastWeek': sunday }, { $unset: { 'weeklyLetter.lastWeek': 1 } });
    console.warn('[Letter] could not write:', e?.message || e);
    return { letter: null, reason: 'failed' };
  }
};

const LETTER_PROMPT = `Write a short letter to your friend about their week, like a handwritten note a close friend slips into
their bag on Sunday evening. Rules:
- 90 to 170 words, 2 or 3 short paragraphs. Start with "Hey {name}," and end with your name on its own line.
- Be specific: mention 2 or 3 real things from THEIR week (from the notes below). Never invent events, people or feelings.
- Warm and honest, in your own voice. One thing you noticed about them, one thing you're curious about or looking forward to.
- If the week was hard, acknowledge it gently and simply. No advice lists, no therapy words ("valid", "journey", "space",
  "self-care", "growth"), no diagnosing, no "I'm here for you", no "remember to". At most one emoji. No em dashes.
- Plain text only. No tags, no markdown, no headings.`;

const writeLetter = async (user: any, from: Date, to: Date, tz: string): Promise<string> => {
  const isAastik = user.persona === 'aarav' || user.persona === 'aastik';
  const bot = isAastik ? 'Aastik' : 'Aastha';
  const first = String(decrypt(user.name || '') || 'friend').split(' ')[0];
  const msgs: any[] = await MessageModel.find({ user: user._id, role: 'user', timestamp: { $gte: from, $lt: to } })
    .sort({ timestamp: 1 }).limit(80).select('content timestamp').lean();
  let budget = 3500;
  const lines: string[] = [];
  for (const m of msgs.slice(-40)) {
    const t = decrypt(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!t || budget - t.length < 0) continue;
    budget -= t.length;
    lines.push(`- (${dayKeyIn(m.timestamp, tz)}) ${t}`);
  }
  const moods: any[] = await Mood.find({ user: user._id, timestamp: { $gte: from, $lt: to } }).select('mood score timestamp').lean();
  const moodLine = moods.length
    ? moods.map((m) => `${dayKeyIn(m.timestamp, tz)}: ${decrypt(m.mood || '')} (${m.score}/10)`).join('; ')
    : 'not logged';
  const facts = (user.facts || []).slice(-8).map((f: string) => decrypt(f)).filter(Boolean);

  const system = `${PERSONA_VOICE[isAastik ? 'aastik' : 'aastha'].trim()}\n\n${LETTER_PROMPT.replace('{name}', first)}`;
  const context = `Their name: ${first}\nYour name: ${bot}\nWhat you know about them: ${facts.join('; ') || '(little so far)'}\nYour running note: ${decrypt(user.memorySummary || '') || '(none)'}\nMoods they logged this week: ${moodLine}\nWhat they said this week (their messages only):\n${lines.join('\n')}`;
  const raw = await completeChat([{ role: 'system', content: system }, { role: 'user', content: context }], { task: 'chat', temperature: 0.8, maxTokens: 700 });
  return noDashes(raw.replace(/<[^>]+>/g, '').replace(/\[[A-Z]+:[^\]]*\]/g, '').replace(/[*#_`]/g, '').trim()).slice(0, 1800);
};

/** Cron: everyone whose letter is due (website users get a push). Small batches; the app catches anyone missed. */
export const runLetterSweep = async (now = new Date()): Promise<number> => {
  if (mongoose.connection.readyState !== 1) return 0;
  const recent = new Date(now.getTime() - 10 * 86_400_000);
  const users: any[] = await User.find({ 'weeklyLetter.enabled': { $ne: false }, lastUsageDate: { $gte: recent } }).select('_id').limit(500).lean();
  let n = 0;
  for (const u of users) {
    const r = await maybeWriteLetter(u._id, now, { push: true });
    if (r.letter) n++;
    if (n >= 25) break; // spread the model calls over sweeps
  }
  return n;
};
