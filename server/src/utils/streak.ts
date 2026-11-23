/**
 * Daily streak on the USER'S local calendar (owner request 2026-11-23: "any time related stuff should be local").
 * Visiting on consecutive local days grows the streak; missing a local day restarts it at 1.
 */
import { dayKeyIn, dayNum, tzOrDefault } from './timeZone';

/** Mutates user.streak / user.lastVisit in memory; returns true if anything changed. */
export const updateStreak = (user: any, now: Date = new Date()): boolean => {
  const tz = tzOrDefault(user.timeZone);
  const last: Date | undefined = user.lastVisit ? new Date(user.lastVisit) : undefined;
  let changed = false;
  if (!last) {
    user.streak = user.streak || 1;
    changed = true;
  } else {
    const gap = dayNum(dayKeyIn(now, tz)) - dayNum(dayKeyIn(last, tz));
    if (gap === 1) { user.streak = (user.streak || 0) + 1; changed = true; }
    else if (gap > 1) { user.streak = 1; changed = true; }
    else if (!user.streak) { user.streak = 1; changed = true; }
  }
  user.lastVisit = now;
  return changed;
};
