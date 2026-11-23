import { describe, it, expect } from 'vitest';
import { loadLockSettings, shouldLockOnReturn, shouldLockForIdle, idleLimitMs, describeLockAfter, LOCK_AFTER_OPTIONS } from '../security/appLock';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
};

describe('app lock settings', () => {
  it('defaults to off, 1 minute', () => {
    expect(loadLockSettings(mem())).toEqual({ enabled: false, afterMs: 60_000, hideInSwitcher: false });
  });
  it('migrates the old "auto-lock" (which logged you out) to a lock with the nearest delay', () => {
    const s = mem({ settings_autoLock: '120000' });
    const r = loadLockSettings(s);
    expect(r.enabled).toBe(true);
    expect(LOCK_AFTER_OPTIONS.map((o) => o.ms)).toContain(r.afterMs);
    expect(s.m.has('settings_autoLock')).toBe(false);
  });
  it('ignores junk', () => {
    expect(loadLockSettings(mem({ aastha_app_lock: '{"enabled":true,"afterMs":12345}' })).afterMs).toBe(60_000);
    expect(loadLockSettings(mem({ aastha_app_lock: 'not json' })).enabled).toBe(false);
  });
});

describe('when to lock', () => {
  const on = { enabled: true, afterMs: 30_000, hideInSwitcher: false };
  it('returning after the grace period locks; a quick glance away does not', () => {
    expect(shouldLockOnReturn(on, 1_000, 40_000)).toBe(true);
    expect(shouldLockOnReturn(on, 1_000, 20_000)).toBe(false);
    expect(shouldLockOnReturn(on, null, 99_000)).toBe(false);
    expect(shouldLockOnReturn({ ...on, enabled: false }, 1_000, 99_000)).toBe(false);
  });
  it('"Immediately" locks on any return, but idle never locks under a minute', () => {
    const now = { ...on, afterMs: 0 };
    expect(shouldLockOnReturn(now, 1_000, 1_001)).toBe(true);
    expect(idleLimitMs(now)).toBe(60_000);
    expect(shouldLockForIdle(now, 0, 59_000, false)).toBe(false);
    expect(shouldLockForIdle(now, 0, 61_000, false)).toBe(true);
  });
  it('music / focus timer running → no idle lock', () => {
    expect(shouldLockForIdle(on, 0, 10 * 60_000, true)).toBe(false);
  });
  it('explains itself', () => {
    expect(describeLockAfter({ ...on, afterMs: 0 })).toMatch(/as soon as you leave/);
    expect(describeLockAfter({ ...on, afterMs: 300_000 })).toMatch(/5 minutes/);
  });
});
