/**
 * Offline queue with backoff (7.1 — "diary sync retry storm").
 *
 * Before: every failed autosave (every 5 s while typing) appended ANOTHER copy to the queue, and every
 * focus/visibility change re-posted the whole queue — so one 429 turned into hundreds of 429s.
 * Now:
 *  - only network errors, 5xx and 429 are queued; other 4xx are real rejections → dropped, not retried
 *  - one entry per key (diary: per day) — the newest version replaces older ones
 *  - one sync at a time; exponential backoff (30 s → 30 min) persisted across reloads, Retry-After honoured
 *  - a sync stops at the first retryable failure instead of hammering the rest of the queue
 *  - sync runs on app start, reconnect ('online') and app resume — never in a loop
 */

export interface QueueItem<T> { key: string; payload: T; queuedAt: number }
interface BackoffState { attempts: number; nextAt: number }

export const BASE_DELAY_MS = 30_000;
export const MAX_DELAY_MS = 30 * 60_000;
export const MAX_ITEMS = 60;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

/** Should this failure be retried later? (network down / server busy / server error) */
export const isRetryable = (err: any): boolean => {
  const status = err?.response?.status ?? err?.status;
  if (!status) return true;               // no response → offline / timeout / CORS / cold start
  return status === 429 || status === 408 || status >= 500;
};

export const retryAfterMs = (err: any): number | null => {
  const h = err?.response?.headers?.['retry-after'];
  if (h == null) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(String(h));
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
};

export const backoffDelay = (attempts: number) => Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1)));

export const createOfflineQueue = <T,>(name: string, opts: {
  send: (payload: T) => Promise<unknown>;
  storage?: Storage;
  now?: () => number;
  onDrained?: () => void;
}) => {
  const KEY = name;
  const BACKOFF_KEY = `${name}__backoff`;
  const store = (): Storage | null => {
    try { return opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null); } catch { return null; }
  };
  const now = opts.now ?? (() => Date.now());
  let running: Promise<void> | null = null;

  const read = (): QueueItem<T>[] => {
    const raw = safeParse<any[]>(store()?.getItem(KEY) ?? null, []);
    if (!Array.isArray(raw)) return [];
    // Legacy format (pre-7.1): plain payload array, possibly with many copies of the same day → keep newest per key
    return raw.map((it: any, i: number) => (it && typeof it === 'object' && 'payload' in it && 'key' in it)
      ? it as QueueItem<T>
      : { key: String(it?.date ?? it?.timestamp ?? it?.tempId ?? i), payload: it as T, queuedAt: 0 });
  };
  const write = (items: QueueItem<T>[]) => {
    const s = store(); if (!s) return;
    try { items.length ? s.setItem(KEY, JSON.stringify(items)) : s.removeItem(KEY); } catch { /* quota */ }
  };
  const readBackoff = (): BackoffState => safeParse(store()?.getItem(BACKOFF_KEY) ?? null, { attempts: 0, nextAt: 0 });
  const writeBackoff = (b: BackoffState) => {
    const s = store(); if (!s) return;
    try { b.attempts ? s.setItem(BACKOFF_KEY, JSON.stringify(b)) : s.removeItem(BACKOFF_KEY); } catch { /* ignore */ }
  };
  const dedupe = (items: QueueItem<T>[]) => {
    const byKey = new Map<string, QueueItem<T>>();
    for (const it of items) byKey.set(it.key, it); // later wins
    return [...byKey.values()].slice(-MAX_ITEMS);
  };

  const api = {
    items: () => dedupe(read()),
    size: () => dedupe(read()).length,
    /** Add (or replace) an item. */
    enqueue(key: string, payload: T) {
      write(dedupe([...read().filter(i => i.key !== key), { key, payload, queuedAt: now() }]));
    },
    remove(key: string) { write(read().filter(i => i.key !== key)); },
    /** Earliest time the next sync may run (0 = now). */
    nextAttemptAt: () => readBackoff().nextAt,
    /** Try to send everything. Safe to call often: single-flight + backoff gate. */
    sync(force = false): Promise<void> {
      if (running) return running;
      running = (async () => {
        // Yield first: on the early-return paths the body would otherwise finish synchronously, running the
        // `finally` BEFORE `running` is assigned → the lock would never clear and syncing would stop for good.
        await null;
        try {
          let items = dedupe(read());
          if (!items.length) { writeBackoff({ attempts: 0, nextAt: 0 }); return; }
          const b = readBackoff();
          if (!force && now() < b.nextAt) return;
          write(items); // persist the de-duplicated form (cleans legacy storms)
          for (const item of items) {
            try {
              await opts.send(item.payload);
              items = items.filter(i => i !== item);
              write(items);
            } catch (err) {
              if (!isRetryable(err)) {         // rejected for good → drop it, keep going
                items = items.filter(i => i !== item);
                write(items);
                continue;
              }
              const attempts = b.attempts + 1;
              const wait = Math.max(backoffDelay(attempts), retryAfterMs(err) ?? 0);
              writeBackoff({ attempts, nextAt: now() + Math.min(wait, MAX_DELAY_MS) });
              return;                           // stop at the first retryable failure
            }
          }
          writeBackoff({ attempts: 0, nextAt: 0 });
          opts.onDrained?.();
        } finally {
          running = null;
        }
      })();
      return running;
    },
  };
  return api;
};
