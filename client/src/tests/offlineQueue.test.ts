import { describe, it, expect } from 'vitest';
import { createOfflineQueue, isRetryable, BASE_DELAY_MS, MAX_DELAY_MS, backoffDelay } from '../services/offlineQueue';

const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const httpErr = (status: number, headers: any = {}) => Object.assign(new Error('x'), { response: { status, headers } });

describe('offline queue (7.1 — diary sync retry storm)', () => {
  it('classifies errors: network/5xx/429 retry, other 4xx do not', () => {
    expect(isRetryable(new Error('Network Error'))).toBe(true);
    expect(isRetryable(httpErr(429))).toBe(true);
    expect(isRetryable(httpErr(503))).toBe(true);
    expect(isRetryable(httpErr(400))).toBe(false);
    expect(isRetryable(httpErr(401))).toBe(false);
  });

  it('keeps ONE entry per day (newest wins) — autosave used to add a copy every 5 s', () => {
    const s = memStorage();
    const q = createOfflineQueue<any>('q', { send: async () => {}, storage: s });
    for (let i = 0; i < 50; i++) q.enqueue('2026-11-20', { content: `v${i}` });
    q.enqueue('2026-11-21', { content: 'other day' });
    expect(q.size()).toBe(2);
    expect(q.items().find(i => i.key === '2026-11-20')!.payload.content).toBe('v49');
  });

  it('a 429 stops the sync and backs off — no request storm', async () => {
    const s = memStorage();
    let t = 1_000_000;
    let calls = 0;
    const q = createOfflineQueue<any>('q', { send: async () => { calls++; throw httpErr(429); }, storage: s, now: () => t });
    q.enqueue('a', 1); q.enqueue('b', 2); q.enqueue('c', 3);
    await q.sync();
    expect(calls).toBe(1);                          // stopped at the first failure
    for (let i = 0; i < 20; i++) await q.sync();    // e.g. 20 focus/resume events
    expect(calls).toBe(1);                          // gated by backoff
    t += BASE_DELAY_MS;
    await q.sync();
    expect(calls).toBe(2);
    expect(q.nextAttemptAt() - t).toBe(backoffDelay(2)); // doubled
    expect(q.size()).toBe(3);                        // nothing lost
  });

  it('honours Retry-After and caps the delay', async () => {
    const s = memStorage();
    const t = 5_000_000;
    const q = createOfflineQueue<any>('q', { send: async () => { throw httpErr(429, { 'retry-after': '120' }); }, storage: s, now: () => t });
    q.enqueue('a', 1);
    await q.sync();
    expect(q.nextAttemptAt() - t).toBe(120_000);
    expect(backoffDelay(50)).toBe(MAX_DELAY_MS);
  });

  it('drops items the server rejects for good and keeps going', async () => {
    const s = memStorage();
    const sent: any[] = [];
    const q = createOfflineQueue<any>('q', { send: async (p) => { if (p === 'bad') throw httpErr(400); sent.push(p); }, storage: s });
    q.enqueue('1', 'bad'); q.enqueue('2', 'good');
    await q.sync();
    expect(sent).toEqual(['good']);
    expect(q.size()).toBe(0);
  });

  it('a gated (early-return) sync never leaves the lock stuck', async () => {
    const s = memStorage();
    let t = 0; let calls = 0;
    const q = createOfflineQueue<any>('q', { send: async () => { calls++; if (calls === 1) throw httpErr(503); }, storage: s, now: () => t });
    q.enqueue('a', 1);
    await q.sync();          // fails → backoff
    await q.sync();          // gated → returns immediately
    t += BASE_DELAY_MS;
    await q.sync();          // must run again
    expect(calls).toBe(2);
    expect(q.size()).toBe(0);
  });

  it('is single-flight: concurrent syncs share one run', async () => {
    const s = memStorage();
    let calls = 0;
    const q = createOfflineQueue<any>('q', { send: async () => { calls++; await new Promise(r => setTimeout(r, 5)); }, storage: s });
    q.enqueue('a', 1);
    await Promise.all([q.sync(), q.sync(), q.sync()]);
    expect(calls).toBe(1);
  });

  it('migrates the legacy queue format and de-duplicates it', async () => {
    const s = memStorage();
    s.setItem('offline_diary_queue', JSON.stringify([
      { title: 'a', content: '1', date: '2026-11-20T12:00:00.000Z', tempId: 'temp-1' },
      { title: 'a', content: '2', date: '2026-11-20T12:00:00.000Z', tempId: 'temp-2' },
    ]));
    const sent: any[] = [];
    const q = createOfflineQueue<any>('offline_diary_queue', { send: async (p) => { sent.push(p.content); }, storage: s });
    expect(q.size()).toBe(1);
    await q.sync();
    expect(sent).toEqual(['2']);
    expect(s.getItem('offline_diary_queue')).toBeNull();
  });
});
