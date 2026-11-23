/**
 * Daily quotas, rolling 24-hour window (owner decision 2026-11-22; replaces the IST-midnight reset of R8).
 *
 * - The window OPENS with the first counted message (`openQuotaWindow`) and the quotas (16 messages,
 *   2 voice notes, clone replies…) refill exactly 24 h later. Fair for bursts and slow chatters alike.
 * - Only the SERVER clock is used. Changing the phone's time or time zone can't refill anything.
 * - One place for all of it, called from `protect`, login and getMe (still at most one write per window).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** IST calendar day, still used by the bond engine's "new day" points (services/relationship.ts). */
export const istDayKey = (d: Date): string => {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  return `${t.getUTCFullYear()}-${t.getUTCMonth() + 1}-${t.getUTCDate()}`;
};

const resetCounters = (user: any, now: Date) => {
  user.dailyMessageCount = 0;
  user.dailyVoiceCount = 0;
  user.dailyPremiumUsage = 0;
  user.dailyGeminiCount = 0;
  user.dailyGroqCount = 0;
  user.voiceHugs = { count: 0, lastReset: now };
  if (user.cloneMode) user.cloneMode.usageCount = 0;
  user.quotaWindowStart = null;
  user.dailyResetAt = now;
};

const hasUsage = (user: any) =>
  (user.dailyMessageCount || 0) > 0 || (user.dailyVoiceCount || 0) > 0 || (user.cloneMode?.usageCount || 0) > 0;

/**
 * Refill if the current 24 h window has ended. Mutates `user` in memory; returns true when something
 * changed (caller saves once).
 */
export const applyDailyReset = (user: any, now: Date = new Date()): boolean => {
  let start: Date | null = user.quotaWindowStart ? new Date(user.quotaWindowStart) : null;
  if (!start) {
    if (!hasUsage(user)) return false; // nothing used → nothing to refill, no window open
    // Legacy users (before rolling windows) with usage but no window: treat the last reset as the start.
    const legacy = user.dailyResetAt || user.lastUsageDate || user.lastMessageDate || user.createdAt;
    start = legacy ? new Date(legacy) : now;
    if (now.getTime() - start.getTime() < QUOTA_WINDOW_MS) {
      user.quotaWindowStart = start;
      return true;
    }
  }
  if (now.getTime() - start.getTime() < QUOTA_WINDOW_MS) return false;
  resetCounters(user, now);
  return true;
};

/** Call when a quota is first used: starts the 24 h clock if it isn't running. */
export const openQuotaWindow = (user: any, now: Date = new Date()) => {
  if (!user.quotaWindowStart) user.quotaWindowStart = now;
};

/** When the quotas refill (ISO), or null if no window is open (= everything is full). */
export const quotaResetsAt = (user: any): string | null =>
  user?.quotaWindowStart ? new Date(new Date(user.quotaWindowStart).getTime() + QUOTA_WINDOW_MS).toISOString() : null;
