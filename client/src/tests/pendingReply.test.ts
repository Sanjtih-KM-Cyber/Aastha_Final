import { describe, it, expect, beforeEach } from 'vitest';

// Minimal localStorage for the node test environment
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const { pendingReply, replyArrived, IN_FLIGHT_MAX_AGE_MS } = await import('../services/pendingReply');

const T = Date.parse('2026-11-24T10:00:00+05:30');

describe('replies survive closing the app', () => {
  beforeEach(() => store.clear());

  it('outbox: typed-but-unsent messages come back once on the next open', () => {
    pendingReply.setOutbox('u1', ['hey', 'you there?']);
    expect(pendingReply.takeOutbox('u1')).toEqual(['hey', 'you there?']);
    expect(pendingReply.takeOutbox('u1')).toEqual([]);
    pendingReply.setOutbox('u1', ['x']);
    pendingReply.setOutbox('u1', []); // sent → cleared
    expect(pendingReply.takeOutbox('u1')).toEqual([]);
  });

  it('in-flight expires after 5 minutes', () => {
    pendingReply.markInFlight('u1', 'hi', T);
    expect(pendingReply.getInFlight('u1', T + 1000)?.text).toBe('hi');
    expect(pendingReply.getInFlight('u1', T + IN_FLIGHT_MAX_AGE_MS + 1)).toBeNull();
  });

  it('reply found by our own message text', () => {
    const p = { sentAt: T, text: 'hey how are you' };
    const old = [{ role: 'user', content: 'earlier', timestamp: T - 60_000 }, { role: 'assistant', content: 'old reply', timestamp: T - 50_000 }];
    expect(replyArrived(old, p)).toBe('no'); // the previous reply is not ours
    expect(replyArrived([...old, { role: 'user', content: 'hey how are you', timestamp: T + 9000 }, { role: 'assistant', content: 'good!', timestamp: T + 9000 }], p)).toBe('reply');
    expect(replyArrived([...old, { role: 'user', content: 'hey how are you', timestamp: T + 2000 }], p)).toBe('user-only'); // she just listened
  });

  it('voice note / photo: newest message is a fresh reply', () => {
    const p = { sentAt: T, text: '' };
    expect(replyArrived([{ role: 'assistant', content: 'old', timestamp: T - 10 * 60_000 }], p)).toBe('no');
    expect(replyArrived([{ role: 'user', content: '[Voice Note]', timestamp: T + 4000 }, { role: 'assistant', content: 'aww', timestamp: T + 4000 }], p)).toBe('reply');
  });

  it('logout wipes every user\'s pending text', () => {
    pendingReply.setOutbox('u1', ['a']);
    pendingReply.markInFlight('u2', 'b');
    store.set('other', 'keep');
    pendingReply.wipeDevice();
    expect([...store.keys()]).toEqual(['other']);
  });
});

describe('"left on seen" notification timing', async () => {
  const { inQuietHours } = await import('../services/seenNudge');
  it('no notification between 22:00 and 09:00 on the phone clock', () => {
    expect(inQuietHours(new Date('2026-11-24T21:59:00+05:30'))).toBe(false);
    expect(inQuietHours(new Date('2026-11-24T22:00:00+05:30'))).toBe(true);
    expect(inQuietHours(new Date('2026-11-25T08:59:00+05:30'))).toBe(true);
    expect(inQuietHours(new Date('2026-11-25T09:00:00+05:30'))).toBe(false);
  });
});
