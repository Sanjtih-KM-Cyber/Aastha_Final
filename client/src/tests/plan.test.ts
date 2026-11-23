import { describe, it, expect } from 'vitest';
import { planLabel } from '../utils/plan';

const now = new Date('2026-11-22T10:00:00+05:30');

describe('credits pill label (7.1, was "16 Premium" on Free)', () => {
  it('free plan shows messages left today', () => {
    expect(planLabel({}, 16, now)).toMatchObject({ kind: 'free', text: '16 messages left', short: '16 left' });
    expect(planLabel({}, 1, now).text).toBe('1 message left');
  });
  it('free plan at 0 → eco mode', () => {
    expect(planLabel({}, 0, now).kind).toBe('eco');
    expect(planLabel({}, NaN, now).kind).toBe('eco');
  });
  it('never shows more than the daily allowance (old 9999 / 20 defaults)', () => {
    expect(planLabel({}, 9999, now).text).toBe('16 messages left');
  });
  it('Pro', () => {
    expect(planLabel({ isPro: true }, 9999, now)).toMatchObject({ kind: 'pro', text: 'Pro', short: 'Pro' });
    expect(planLabel({ subscriptionExpiresAt: '2026-12-20T00:00:00Z' }, 3, now).kind).toBe('pro');
    expect(planLabel({ subscriptionExpiresAt: '2026-11-01T00:00:00Z' }, 3, now).kind).toBe('free');
  });
  it('out of messages → shows when they refill (rolling 24 h)', () => {
    const l = planLabel({}, 0, now, new Date('2026-11-22T15:40:00+05:30').toISOString());
    expect(l.kind).toBe('eco');
    expect(l.short).toMatch(/^Refills at 3:40/);
    expect(planLabel({}, 0, now, new Date('2026-11-21T10:00:00Z').toISOString()).short).toBe('Eco'); // stale time ignored
  });
  it('Voice Pass shows when it ends', () => {
    const l = planLabel({ voicePassExpiresAt: new Date('2026-11-22T21:00:00+05:30').toISOString() }, 5, now);
    expect(l.kind).toBe('voice');
    expect(l.text).toMatch(/^Voice Pass until /);
  });
});
