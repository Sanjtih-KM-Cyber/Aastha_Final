/**
 * Replies that must survive closing the app (2026-11-24 bug: "I send a message, close the app, the reply never comes").
 *
 * Two things are remembered per user in localStorage:
 *  - outbox:  messages typed but not sent yet (the 6 s "wait for more messages" pause). If the app is closed during
 *             the pause they are sent on the next open instead of being lost.
 *  - inFlight: a message the server has received but whose reply we didn't get (connection dropped / app closed).
 *             The server still finishes and saves the reply, so the app keeps checking history until it's there.
 */
const OUTBOX = 'aastha_outbox_v1:';
const IN_FLIGHT = 'aastha_inflight_v1:';
export const IN_FLIGHT_MAX_AGE_MS = 5 * 60_000; // after this we stop looking (server gave up or never got it)

export interface InFlight { sentAt: number; text: string }

const read = <T,>(key: string): T | null => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
};
const write = (key: string, v: unknown) => {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full/blocked */ }
};

export const pendingReply = {
  setOutbox(userId: string | undefined, texts: string[]) { if (userId) write(OUTBOX + userId, texts.length ? texts : null); },
  takeOutbox(userId: string | undefined): string[] {
    if (!userId) return [];
    const v = read<string[]>(OUTBOX + userId);
    write(OUTBOX + userId, null);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string' && t.trim()) : [];
  },
  markInFlight(userId: string | undefined, text: string, sentAt = Date.now()) { if (userId) write(IN_FLIGHT + userId, { sentAt, text }); },
  getInFlight(userId: string | undefined, now = Date.now()): InFlight | null {
    if (!userId) return null;
    const v = read<InFlight>(IN_FLIGHT + userId);
    if (!v || typeof v.sentAt !== 'number') return null;
    if (now - v.sentAt > IN_FLIGHT_MAX_AGE_MS) { write(IN_FLIGHT + userId, null); return null; }
    return v;
  },
  clearInFlight(userId: string | undefined) { if (userId) write(IN_FLIGHT + userId, null); },
  /** Logout: nothing of anyone's unsent text stays on the device. */
  wipeDevice() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(OUTBOX) || k.startsWith(IN_FLIGHT))) localStorage.removeItem(k);
      }
    } catch { /* ignore */ }
  },
};

type Msg = { role: string; content?: string; timestamp: number | string };
const ms = (t: number | string) => new Date(t).getTime() || 0;

/**
 * Has the server's history got the reply to `p` yet?
 *  'reply'     our message (same text, around that time) is saved with an assistant reply after it
 *  'user-only' our message is saved with no reply: Aastha chose to just listen (the server saves the message
 *              together with the reply otherwise), so stop looking
 *  'no'        not there yet
 * Voice notes / photos are saved with different text (p.text = ''): then the newest message must be an
 * assistant reply newer than our send (2 min clock-skew allowance).
 */
export const replyArrived = (history: Msg[], p: InFlight): 'reply' | 'user-only' | 'no' => {
  if (!history.length) return 'no';
  const want = p.text.trim();
  if (want) {
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (ms(m.timestamp) < p.sentAt - 10 * 60_000) break;
      if (m.role === 'user' && String(m.content || '').trim() === want) {
        return history.slice(i + 1).some((n) => n.role === 'assistant') ? 'reply' : 'user-only';
      }
    }
    return 'no';
  }
  const last = history[history.length - 1];
  return last.role === 'assistant' && ms(last.timestamp) > p.sentAt - 2 * 60_000 ? 'reply' : 'no';
};
