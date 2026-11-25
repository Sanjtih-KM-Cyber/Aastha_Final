/**
 * Time sense (owner, 2026-11-24): "I started a chat in the morning, left it, came back at 10 pm and she carried on
 * like no time had passed ('after waking up early I'm in a daze')."
 *
 * The prompt had the current time but nothing said the earlier messages were from hours ago, so the model treated
 * them as one continuous conversation. Now, from the gap between the last saved message and this one:
 *  - < 30 min: nothing (same conversation)
 *  - 30 min to 3 h: a short break, picking up the thread is fine
 *  - ≥ 3 h: a NEW moment. Don't continue the old thread or answer old questions as if it were seconds ago; greet
 *    for the time it is now; may notice once, lightly, that they went quiet; follow them if they go back to it.
 *  - ≥ 6 h: also only the last few old messages are sent (so a stale thread doesn't steer the reply).
 * All on the user's own clock.
 */
import { dayKeyIn, dayNum, hourIn, tzOrDefault } from '../utils/timeZone';

export const SHORT_BREAK_MIN = 30;
export const NEW_MOMENT_H = 3;
export const TRIM_HISTORY_H = 6;
export const KEEP_AFTER_LONG_GAP = 6; // old messages kept after a ≥ 6 h gap

const partOfDay = (h: number) => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night');

const human = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} minutes`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d} days` : d < 60 ? `${Math.round(d / 7)} weeks` : 'a long time';
};

export interface GapInfo { line?: string; gapMs: number; trim: boolean }

export const describeGap = (last: Date | string | number | undefined, now: Date, timeZone?: string): GapInfo => {
  if (!last) return { gapMs: 0, trim: false };
  const lastD = new Date(last);
  const gapMs = now.getTime() - lastD.getTime();
  if (!(gapMs >= SHORT_BREAK_MIN * 60_000)) return { gapMs: Math.max(0, gapMs || 0), trim: false };
  const tz = tzOrDefault(timeZone);
  const thenPart = partOfDay(hourIn(lastD, tz));
  const nowPart = partOfDay(hourIn(now, tz));
  const days = dayNum(dayKeyIn(now, tz)) - dayNum(dayKeyIn(lastD, tz));
  const when = days === 0 ? `this ${thenPart}` : days === 1 ? `yesterday ${thenPart === 'night' ? 'night' : thenPart}` : `${days} days ago`;
  const gap = human(gapMs);

  if (gapMs < NEW_MOMENT_H * 3_600_000) {
    return { gapMs, trim: false, line: `Time since the last message: about ${gap} (a short break). Picking up where you left off is fine.` };
  }
  return {
    gapMs,
    trim: gapMs >= TRIM_HISTORY_H * 3_600_000,
    line: `Time since the last message: about ${gap}. Their last message was ${when}; it's ${nowPart} now. This is a NEW moment, not the same conversation: `
      + `don't carry on the old thread or answer an old question as if it were seconds ago, and don't talk as if it's still ${days === 0 ? thenPart : 'that day'} `
      + `(no "just woke up" talk at night). React to now, like a friend picking the chat back up later in the day. `
      + `If they left mid-conversation you can notice it once, lightly and without guilt ("you vanished on me this morning 👀"), then go with whatever they say now. `
      + `Only go back to the old topic if they do.`,
  };
};
