/**
 * App lock settings + decisions (pure, unit-tested in tests/appLock.test.ts).
 *
 * One lock system for phone and web (components/auth/BiometricGuard.tsx):
 *  - unlock with fingerprint / face / the phone's PIN (native) or the account password (web, or as a fallback)
 *  - locks on cold start, when you come back after being away for `afterMs`, and after being idle in the app
 *    for max(afterMs, 1 min), idle lock is paused while music / a focus timer keeps the app "busy"
 * Replaces the old pair (biometric guard + "auto-lock" that LOGGED YOU OUT after inactivity).
 */
export interface LockSettings {
  enabled: boolean;
  afterMs: number;          // grace period after leaving the app (0 = immediately)
  hideInSwitcher: boolean;  // native: blank the app in "recent apps" (Android also blocks screenshots)
}

export const LOCK_AFTER_OPTIONS: { ms: number; label: string; short: string }[] = [
  { ms: 0, label: 'Immediately', short: 'Now' },
  { ms: 30_000, label: '30 seconds', short: '30 s' },
  { ms: 60_000, label: '1 minute', short: '1 min' },
  { ms: 300_000, label: '5 minutes', short: '5 min' },
  { ms: 900_000, label: '15 minutes', short: '15 min' },
  { ms: 3_600_000, label: '1 hour', short: '1 h' },
];

const KEY = 'aastha_app_lock';
export const LOCK_EVENT = 'aastha:app-lock-settings';
export const LOCK_NOW_EVENT = 'aastha:lock-now';
const DEFAULTS: LockSettings = { enabled: false, afterMs: 60_000, hideInSwitcher: false };

const nearestOption = (ms: number) =>
  LOCK_AFTER_OPTIONS.reduce((best, o) => (Math.abs(o.ms - ms) < Math.abs(best.ms - ms) ? o : best), LOCK_AFTER_OPTIONS[2]).ms;

/** Reads settings; migrates the old "settings_autoLock" (ms, 0 = off) once. */
export const loadLockSettings = (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): LockSettings => {
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        enabled: !!s.enabled,
        afterMs: LOCK_AFTER_OPTIONS.some((o) => o.ms === s.afterMs) ? s.afterMs : DEFAULTS.afterMs,
        hideInSwitcher: !!s.hideInSwitcher,
      };
    }
    const legacy = parseInt(storage.getItem('settings_autoLock') || '0', 10);
    if (legacy > 0) {
      const migrated = { ...DEFAULTS, enabled: true, afterMs: nearestOption(legacy) };
      storage.setItem(KEY, JSON.stringify(migrated));
      storage.removeItem('settings_autoLock');
      return migrated;
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
};

export const saveLockSettings = (s: LockSettings, storage: Pick<Storage, 'setItem'> = localStorage) => {
  try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(LOCK_EVENT)); } catch { /* not in a browser (tests) */ }
};

/** Coming back to the app: lock if we were away for at least the grace period. */
export const shouldLockOnReturn = (s: LockSettings, hiddenAt: number | null, now: number) =>
  s.enabled && hiddenAt !== null && now - hiddenAt >= s.afterMs;

/** Idle inside the app, never shorter than a minute (so "Immediately" doesn't lock you while reading). */
export const idleLimitMs = (s: LockSettings) => Math.max(s.afterMs, 60_000);
export const shouldLockForIdle = (s: LockSettings, lastActivity: number, now: number, busy: boolean) =>
  s.enabled && !busy && now - lastActivity >= idleLimitMs(s);

export const describeLockAfter = (s: LockSettings) => {
  const o = LOCK_AFTER_OPTIONS.find((x) => x.ms === s.afterMs);
  const idle = LOCK_AFTER_OPTIONS.find((x) => x.ms === idleLimitMs(s));
  return s.afterMs === 0
    ? `Locks as soon as you leave the app, and after ${idle?.label || '1 minute'} without touching it.`
    : `Locks when you've been away for ${o?.label || ''}, or after ${idle?.label || ''} without touching it.`;
};
