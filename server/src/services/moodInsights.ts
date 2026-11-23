/**
 * Mood over time (ROADMAP 7.4): a 7-day view + at most ONE honest insight from data we already store
 * (daily mood scores 1–10 and whether a diary entry exists that day). No diagnoses, no scores about the
 * person, only patterns in their own logs, with minimum sample sizes so we never over-claim.
 */
import mongoose from 'mongoose';
import Mood from '../models/Mood';
import Diary from '../models/Diary';
import { decrypt } from '../utils/serverEncryption';
import { dayKeyIn, DEFAULT_TZ, tzOrDefault } from '../utils/timeZone';

export interface DayMood { day: string; score: number | null; mood: string | null }
export interface MoodInsights { week: (DayMood & { label: string })[]; insight: string | null; daysLogged28: number; note: string }

export const MIN_DAYS_PER_GROUP = 3;
export const MIN_DIFF = 1.0;
const NOTE = 'Patterns from your own logs, not a diagnosis.';

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const shiftDay = (key: string, delta: number) => new Date(Date.parse(`${key}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/** Pure: daily scores (IST day → score) + diary days → insights (exported for tests). */
export const computeInsights = (daily: Map<string, { score: number; mood: string }>, diaryDays: Set<string>, now = new Date(), tz: string = DEFAULT_TZ): MoodInsights => {
  const today = dayKeyIn(now, tzOrDefault(tz));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(today, i - 6);
    const d = daily.get(day);
    const label = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
    return { day, label, score: d ? round1(d.score) : null, mood: d?.mood ?? null };
  });

  const last28 = Array.from({ length: 28 }, (_, i) => shiftDay(today, -i)).filter((k) => daily.has(k));
  const journaled = last28.filter((k) => diaryDays.has(k)).map((k) => daily.get(k)!.score);
  const notJournaled = last28.filter((k) => !diaryDays.has(k)).map((k) => daily.get(k)!.score);

  let insight: string | null = null;
  if (journaled.length >= MIN_DAYS_PER_GROUP && notJournaled.length >= MIN_DAYS_PER_GROUP) {
    const a = avg(journaled), b = avg(notJournaled);
    if (Math.abs(a - b) >= MIN_DIFF) {
      insight = a > b
        ? `On days you journaled, your mood averaged ${round1(a)}/10, vs ${round1(b)}/10 on days you didn't. Writing things down seems to help you.`
        : `Your mood was lower on days you journaled (${round1(a)}/10 vs ${round1(b)}/10). That's common, many people write more on hard days.`;
    }
  }
  if (!insight) {
    const thisWeek = week.map((d) => d.score).filter((s): s is number => s !== null);
    const prevWeek = Array.from({ length: 7 }, (_, i) => daily.get(shiftDay(today, -7 - i))?.score).filter((s): s is number => typeof s === 'number');
    if (thisWeek.length >= MIN_DAYS_PER_GROUP && prevWeek.length >= MIN_DAYS_PER_GROUP) {
      const a = avg(thisWeek), b = avg(prevWeek);
      if (Math.abs(a - b) >= MIN_DIFF) {
        insight = a > b
          ? `This week has felt lighter than last (${round1(a)}/10 vs ${round1(b)}/10 on average).`
          : `This week has been heavier than last (${round1(a)}/10 vs ${round1(b)}/10). Go easy on yourself.`;
      }
    }
  }
  return { week, insight, daysLogged28: last28.length, note: NOTE };
};

export const getMoodInsights = async (userId: string | mongoose.Types.ObjectId, now = new Date(), tz?: string): Promise<MoodInsights> => {
  const zone = tzOrDefault(tz);
  const since = new Date(now.getTime() - 35 * 86_400_000);
  const [moods, diaries] = await Promise.all([
    Mood.find({ user: userId, timestamp: { $gte: since } }).select('mood score count timestamp').lean(),
    Diary.find({ user: userId, entryDate: { $gte: since } }).select('entryDate').lean(),
  ]);
  // Several logs on one day → weighted average (a Mood doc may already average `count` logs)
  const acc = new Map<string, { sum: number; n: number; mood: string }>();
  for (const m of moods as any[]) {
    const k = dayKeyIn(m.timestamp, zone);
    const n = Math.max(1, Number(m.count) || 1);
    const cur = acc.get(k) || { sum: 0, n: 0, mood: '' };
    cur.sum += Number(m.score) * n; cur.n += n; cur.mood = decrypt(m.mood || '') || cur.mood;
    acc.set(k, cur);
  }
  const daily = new Map<string, { score: number; mood: string }>();
  acc.forEach((v, k) => { if (v.n && Number.isFinite(v.sum)) daily.set(k, { score: v.sum / v.n, mood: v.mood }); });
  // Diary entryDate is saved as noon UTC of the chosen local day → its UTC date is the user's day
  const diaryDays = new Set((diaries as any[]).map((d) => new Date(d.entryDate).toISOString().slice(0, 10)));
  return computeInsights(daily, diaryDays, now, zone);
};
