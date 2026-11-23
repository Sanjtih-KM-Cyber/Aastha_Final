/**
 * Local cache of the most recent chat messages so the chat screen renders instantly
 * (instead of blocking on "Connecting to Aastha…" while the server wakes up, ROADMAP M2).
 * Scoped per user and cleared on logout.
 */
const PREFIX = 'aastha_chat_cache_v1:';
const MAX = 50;

type CachedMessage = {
  id?: string;
  role: string;
  content: string;
  timestamp: number | string;
  voice_note?: string;
};

const keyFor = (userId?: string) => (userId ? PREFIX + userId : null);

export const chatCache = {
  load(userId?: string): CachedMessage[] | null {
    const key = keyFor(userId);
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  },

  save(userId: string | undefined, messages: any[]) {
    const key = keyFor(userId);
    if (!key) return;
    try {
      const clean: CachedMessage[] = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-MAX)
        .map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp, voice_note: m.voice_note }));
      if (clean.length > 0) localStorage.setItem(key, JSON.stringify(clean));
    } catch {
      // Storage full / unavailable, cache is best-effort only.
    }
  },

  clearAll() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};
