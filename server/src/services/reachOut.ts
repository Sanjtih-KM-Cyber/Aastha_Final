/**
 * "Aastha reaches out first" (ROADMAP 7.4).
 *
 * Memory marks dated things the user mentioned ("exam on Friday") as follow-ups. The day after, Aastha
 * gently checks in, in chat if they're around, otherwise one notification.
 * Everything runs on the USER'S OWN local time (`user.timeZone`, sent by the app; India until we know it).
 * Caps (all enforced here, server-side):
 *  - at most 1 check-in per local day, at most 1 per follow-up
 *  - quiet hours 21:00–10:00 local time (notifications are only sent 10:00–21:00)
 *  - never within 48 h of a crisis message (a crisis day and the day after are left alone)
 *  - off switch: user.reachOut.enabled === false → nothing is sent or scheduled
 *  - not while they're already active (last visit < 3 h), then Aastha just asks in chat
 * Follow-up text is user-derived and encrypted at rest; the check-in copy is a fixed, gentle template
 * (no LLM, no guilt, no "where have you been").
 */
import mongoose from 'mongoose';
import User from '../models/User';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { isWebPushConfigured, sendToUser } from './webPush';
import { DEFAULT_TZ, tzOrDefault, dayKeyIn, hourIn, localAt, dayNum } from '../utils/timeZone';

export const MAX_PENDING = 10;
export const MAX_DAYS_AHEAD = 60;
export const FOLLOW_UP_WINDOW_DAYS = 3;   // ask about it from the due day up to 3 days later
export const CRISIS_COOLDOWN_MS = 48 * 3_600_000;
export const ACTIVE_RECENTLY_MS = 3 * 3_600_000;
export const QUIET_START_HOUR = 21;      // local time
export const QUIET_END_HOUR = 10;        // local time
export const CHECK_IN_HOUR = 10;         // local time, scheduled notifications fire at 10:00 the day after

/** Kept for callers that only need India time (daily quota reset etc.). */
export const istDayKey = (d: Date | number) => dayKeyIn(d, DEFAULT_TZ);
export const istHour = (d: Date | number) => hourIn(d, DEFAULT_TZ);
export const istAt = (key: string, hour: number) => localAt(key, hour, DEFAULT_TZ);

export interface FollowUpDoc { _id?: any; text: string; dueDate: Date; status: 'pending' | 'asked' | 'sent' | 'dismissed'; createdAt?: Date }
export interface ExtractedFollowUp { event?: unknown; date?: unknown }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const cleanEvent = (e: unknown) => String(e ?? '').replace(/[<>\[\]{}`*_#\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const isQuiet = (now: Date, tz: string) => { const h = hourIn(now, tz); return h >= QUIET_START_HOUR || h < QUIET_END_HOUR; };

/**
 * Merge newly extracted follow-ups into the stored list (pure; texts in `existing` are already decrypted).
 * Dates are the user's local calendar days. Keeps only real future dates within 60 days, de-duplicates,
 * drops ones whose window has closed, caps the pending list.
 */
export const mergeFollowUps = (existing: FollowUpDoc[], extracted: ExtractedFollowUp[], now = new Date(), tz: string = DEFAULT_TZ): FollowUpDoc[] => {
  const zone = tzOrDefault(tz);
  const today = dayNum(dayKeyIn(now, zone));
  const kept = existing.filter((f) => dayNum(dayKeyIn(f.dueDate, zone)) >= today - FOLLOW_UP_WINDOW_DAYS);
  const seen = new Set(kept.map((f) => `${norm(f.text)}|${dayKeyIn(f.dueDate, zone)}`));
  for (const x of Array.isArray(extracted) ? extracted : []) {
    const text = cleanEvent(x?.event);
    const date = typeof x?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : '';
    if (text.length < 3 || !date) continue;
    const d = dayNum(date);
    if (!Number.isFinite(d) || d < today || d > today + MAX_DAYS_AHEAD) continue;
    const key = `${norm(text)}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ text, dueDate: localAt(date, 12, zone), status: 'pending', createdAt: now }); // local noon of that day
  }
  const pending = kept.filter((f) => f.status === 'pending').sort((a, b) => +a.dueDate - +b.dueDate).slice(0, MAX_PENDING);
  const others = kept.filter((f) => f.status !== 'pending').slice(-MAX_PENDING);
  return [...others, ...pending];
};

const ageInDays = (f: FollowUpDoc, now: Date, tz: string) => dayNum(dayKeyIn(now, tz)) - dayNum(dayKeyIn(f.dueDate, tz));

/** Follow-ups that are "around now" for an in-chat mention (due day … +3 days, still pending). */
export const followUpsAroundNow = (list: FollowUpDoc[], now = new Date(), tz: string = DEFAULT_TZ) =>
  list.filter((f) => f.status === 'pending' && ageInDays(f, now, tzOrDefault(tz)) >= 0 && ageInDays(f, now, tzOrDefault(tz)) <= FOLLOW_UP_WINDOW_DAYS);

const whenWord = (f: FollowUpDoc, now: Date, tz: string) => {
  const age = ageInDays(f, now, tz);
  if (age === 0) return 'today';
  if (age === 1) return 'yesterday';
  return `${age} days ago`;
};

export const followUpPromptLine = (list: FollowUpDoc[], now = new Date(), tz: string = DEFAULT_TZ): string => {
  const zone = tzOrDefault(tz);
  const items = followUpsAroundNow(list, now, zone).slice(0, 2);
  if (!items.length) return '';
  const what = items.map((f) => `${f.text} (${whenWord(f, now, zone)})`).join('; ');
  return `Something they told you about is happening around now: ${what}. If it fits naturally, ask how it went/is going, once, lightly, no pressure. Skip it if they're upset about something else.`;
};

export interface ReachOutState { enabled?: boolean; lastSentAt?: Date | null; lastCrisisAt?: Date | null }

export const reachOutBlockedReason = (state: ReachOutState | undefined, lastVisit: Date | undefined, now = new Date(), tz: string = DEFAULT_TZ): string | null => {
  const zone = tzOrDefault(tz);
  if (state?.enabled === false) return 'off';
  if (isQuiet(now, zone)) return 'quiet_hours';
  if (state?.lastCrisisAt && now.getTime() - new Date(state.lastCrisisAt).getTime() < CRISIS_COOLDOWN_MS) return 'crisis_recent';
  if (state?.lastSentAt && dayKeyIn(state.lastSentAt, zone) === dayKeyIn(now, zone)) return 'already_today';
  if (lastVisit && now.getTime() - new Date(lastVisit).getTime() < ACTIVE_RECENTLY_MS) return 'active_recently';
  return null;
};

/** A follow-up ready for a check-in notification: pending and its day has passed (1–3 days ago). */
export const dueForCheckIn = (list: FollowUpDoc[], now = new Date(), tz: string = DEFAULT_TZ) => {
  const zone = tzOrDefault(tz);
  return list.filter((f) => f.status === 'pending' && ageInDays(f, now, zone) >= 1 && ageInDays(f, now, zone) <= FOLLOW_UP_WINDOW_DAYS)
    .sort((a, b) => +a.dueDate - +b.dueDate)[0];
};

export const checkInText = (firstName: string, event: string) =>
  `Hey ${firstName || 'you'} 🙂 how did ${/^(the|your|my|their|his|her) /i.test(event) ? event : `the ${event}`} go? No pressure to reply, just thinking of you.`;

const decryptList = (list: any[]): FollowUpDoc[] => (list || []).map((f) => ({ ...(f.toObject ? f.toObject() : f), text: decrypt(f.text || '') }));
const encryptList = (list: FollowUpDoc[]) => list.map((f) => ({ ...f, text: encrypt(f.text) }));

export const saveExtractedFollowUps = async (userId: string | mongoose.Types.ObjectId, extracted: ExtractedFollowUp[]) => {
  if (!Array.isArray(extracted) || !extracted.length) return;
  const u: any = await User.findById(userId).select('followUps timeZone');
  if (!u) return;
  const merged = mergeFollowUps(decryptList(u.followUps), extracted, new Date(), u.timeZone);
  await User.updateOne({ _id: userId }, { $set: { followUps: encryptList(merged) } });
};

/** Mark follow-ups as handled (asked in chat / sent as a notification / dismissed). */
export const markFollowUps = async (userId: string | mongoose.Types.ObjectId, ids: any[], status: FollowUpDoc['status']) => {
  if (!ids.length) return;
  await User.updateOne({ _id: userId }, { $set: { 'followUps.$[f].status': status } }, { arrayFilters: [{ 'f._id': { $in: ids } }] });
};

/**
 * What the phone app should schedule as local notifications (native app has no server push).
 * One per local day, at 10:00 local time the day after the event, never inside the crisis cooldown.
 */
export const upcomingCheckIns = (user: any, now = new Date()) => {
  const state: ReachOutState = user.reachOut || {};
  if (state.enabled === false) return [];
  const zone = tzOrDefault(user.timeZone);
  const crisisUntil = state.lastCrisisAt ? new Date(state.lastCrisisAt).getTime() + CRISIS_COOLDOWN_MS : 0;
  const first = String(user.name || '').split(' ')[0];
  const byDay = new Map<string, { id: string; at: string; title: string; body: string }>();
  for (const f of decryptList(user.followUps).filter((x) => x.status === 'pending').sort((a, b) => +a.dueDate - +b.dueDate)) {
    const dayAfter = new Date(Date.parse(`${dayKeyIn(f.dueDate, zone)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    let at = localAt(dayAfter, CHECK_IN_HOUR, zone);
    if (at.getTime() < now.getTime()) {
      // already past 10:00 the day after: if still inside the window and not quiet hours, fire in 2 minutes
      if (ageInDays(f, now, zone) > FOLLOW_UP_WINDOW_DAYS || isQuiet(now, zone)) continue;
      at = new Date(now.getTime() + 2 * 60_000);
    }
    if (at.getTime() < crisisUntil) continue;
    const day = dayKeyIn(at, zone);
    if (state.lastSentAt && dayKeyIn(state.lastSentAt, zone) === day) continue;
    if (byDay.has(day)) continue;
    byDay.set(day, { id: String(f._id), at: at.toISOString(), title: user.persona === 'aarav' ? 'Aastik' : 'Aastha', body: checkInText(first, f.text) });
  }
  return [...byDay.values()].slice(0, 5);
};

/** Cron sweep (every 15 min): web push check-ins for website/PWA users, each on their own local time. */
export const runReachOutSweep = async (now = new Date()) => {
  if (!isWebPushConfigured()) return 0;
  const from = new Date(now.getTime() - (FOLLOW_UP_WINDOW_DAYS + 1) * 86_400_000);
  const users: any[] = await User.find({
    followUps: { $elemMatch: { status: 'pending', dueDate: { $lte: new Date(now.getTime() - 12 * 3_600_000), $gte: from } } },
    'reachOut.enabled': { $ne: false },
  }).select('name persona followUps reachOut lastVisit timeZone').limit(200);
  let sent = 0;
  for (const u of users) {
    try {
      const zone = tzOrDefault(u.timeZone);
      if (reachOutBlockedReason(u.reachOut, u.lastVisit, now, zone)) continue;
      const f = dueForCheckIn(decryptList(u.followUps), now, zone);
      if (!f) continue;
      const pushed = await sendToUser(u._id.toString(), {
        title: u.persona === 'aarav' ? 'Aastik' : 'Aastha',
        body: checkInText(String(u.name || '').split(' ')[0], f.text),
        tag: 'aastha-follow-up',
      });
      if (pushed > 0) {
        sent++;
        await User.updateOne({ _id: u._id }, { $set: { 'reachOut.lastSentAt': now } });
        await markFollowUps(u._id, [f._id], 'sent');
      }
    } catch (e: any) {
      console.error('[ReachOut] user failed:', e?.message || e);
    }
  }
  return sent;
};
