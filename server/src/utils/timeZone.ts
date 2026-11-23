/**
 * Per-user local time (IANA zones like "Asia/Kolkata", "America/New_York"), DST-safe, no dependencies.
 * Used by check-ins (services/reachOut.ts), mood insights and the memory "Today" line.
 * The app sends the device zone; until we know it we assume India (most users).
 */
export const DEFAULT_TZ = 'Asia/Kolkata';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const formatter = (tz: string) => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
};

/** A real IANA zone name, or null. Rejects junk / overlong input (it is stored on the user). */
export const cleanTimeZone = (tz: unknown): string | null => {
  if (typeof tz !== 'string' || !tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return null;
  try { formatter(tz); return tz; } catch { return null; }
};

export const tzOrDefault = (tz: unknown) => cleanTimeZone(tz) || DEFAULT_TZ;

const parts = (d: Date | number, tz: string) => {
  const out: Record<string, number> = {};
  for (const p of formatter(tzOrDefault(tz)).formatToParts(new Date(d))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' of that moment in the zone. */
export const dayKeyIn = (d: Date | number, tz: string) => {
  const p = parts(d, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/** 0–23 hour of that moment in the zone. */
export const hourIn = (d: Date | number, tz: string) => parts(d, tz).hour;

/** Zone offset (ms, local − UTC) at an instant. */
const offsetAt = (instant: number, tz: string) => {
  const p = parts(instant, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
};

/** The UTC instant of `hour`:00 local time on local day `key` in the zone (DST-safe). */
export const localAt = (key: string, hour: number, tz: string): Date => {
  const zone = tzOrDefault(tz);
  const wall = Date.parse(`${key}T${pad(hour)}:00:00Z`);
  let t = wall - offsetAt(wall, zone);
  const second = offsetAt(t, zone);
  if (wall - second !== t) t = wall - second; // crossed a DST change
  return new Date(t);
};

/** Day number for comparing 'YYYY-MM-DD' keys. */
export const dayNum = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/** Weekday name in the zone, e.g. "Sunday". */
export const weekdayIn = (d: Date | number, tz: string) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'long', timeZone: tzOrDefault(tz) });
