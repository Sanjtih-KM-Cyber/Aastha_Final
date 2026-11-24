/**
 * "Left on seen" follow-up when the app is CLOSED (2026-11-24). The in-app nudge (ChatView, 45 s) only works while
 * the chat is on screen, so reading a reply and leaving the app never got a "you there?".
 *
 * Phone app going to the background with her reply as the last message:
 *   1. ask the server for a follow-up WITHOUT saving it (POST /chat/nudge { deferred: true } → text + signed token)
 *   2. schedule it as a local notification ~20 min later (not in quiet hours: 22:00 to 09:00 on the phone's clock)
 * Coming back:
 *   - before it fired → cancel it, nothing is saved (the normal in-app nudge can still happen)
 *   - after it fired  → POST /chat/nudge/commit saves it, so the chat shows what the notification said
 * The server keeps all the rules (once per reply, 6/day, none within 12 h of a crisis, not after they answered).
 */
import api from './api';
import { NOTIF_IDS, cancelIds, scheduleOne, hasPermission, isNative } from './notifications';

const KEY = 'aastha_seen_nudge_v1';
export const SEEN_NUDGE_DELAY_MS = 20 * 60_000;

interface Prepared { forId: string; content: string; preparedAt: number; token: string; fireAt: number }

const load = (): Prepared | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const save = (p: Prepared | null) => { try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY); } catch { /* ignore */ } };

/** Quiet hours on the phone's own clock: nothing between 22:00 and 09:00. */
export const inQuietHours = (d: Date) => d.getHours() >= 22 || d.getHours() < 9;

let preparing = false;

export const seenNudge = {
  /** App → background. `lastAssistantId` = her reply's saved id when it's the last message, else undefined. */
  async prepare(lastAssistantId: string | undefined, botName: string, now = Date.now()) {
    if (!isNative() || preparing || !lastAssistantId || !/^[0-9a-f]{24}$/i.test(lastAssistantId)) return;
    const fireAt = now + SEEN_NUDGE_DELAY_MS;
    if (inQuietHours(new Date(fireAt))) return;
    if (load()?.forId === lastAssistantId) return; // already scheduled for this reply
    preparing = true;
    try {
      if (!(await hasPermission())) return;
      const r = await api.post('/chat/nudge', { reason: 'seen', messageId: lastAssistantId, deferred: true });
      if (r.status !== 200 || !r.data?.content || !r.data?.token) return;
      const p: Prepared = { forId: lastAssistantId, content: String(r.data.content), preparedAt: Number(r.data.preparedAt), token: String(r.data.token), fireAt };
      await scheduleOne({ id: NOTIF_IDS.SEEN_NUDGE, title: botName, body: p.content, at: new Date(fireAt) });
      save(p);
    } catch { /* offline / not allowed: it's only a nicety */ }
    finally { preparing = false; }
  },

  /**
   * App → foreground. Returns the saved message when the notification had already fired (so the chat can show it),
   * otherwise cancels the pending notification.
   */
  async settle(now = Date.now()): Promise<{ id: string; content: string; timestamp: number } | null> {
    const p = load();
    if (!p) return null;
    save(null);
    if (now < p.fireAt) { await cancelIds([NOTIF_IDS.SEEN_NUDGE]); return null; }
    try {
      const r = await api.post('/chat/nudge/commit', { messageId: p.forId, content: p.content, preparedAt: p.preparedAt, token: p.token });
      if (r.status === 200 && r.data?.content) {
        return { id: String(r.data.id || `nudge-${now}`), content: String(r.data.content), timestamp: r.data.timestamp ? new Date(r.data.timestamp).getTime() : now };
      }
    } catch { /* ignore */ }
    return null;
  },

  /** They sent a message: whatever was prepared is out of date. */
  async cancel() { if (load()) { save(null); await cancelIds([NOTIF_IDS.SEEN_NUDGE]); } },

  /** Logout */
  wipe() { save(null); cancelIds([NOTIF_IDS.SEEN_NUDGE]).catch(() => {}); },
};
