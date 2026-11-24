/**
 * "Aastha reaches out first" on the phone app (ROADMAP 7.4).
 * The native app has no server push (no Firebase), so the server tells us which gentle check-ins are coming
 * (GET /users/reach-out → already capped: 1/day, 10:00 in the user's own time zone, crisis cooldown, off switch) and we schedule them
 * as local notifications in our own ID range. Website/PWA users get the same check-ins via Web Push instead.
 */
import api from './api';
import { deviceTimeZone } from '../utils/timeZone';
import { NOTIF_IDS, cancelIds, scheduleOne, hasPermission, isNative } from './notifications';

export interface UpcomingCheckIn { id: string; at: string; title: string; body: string }

const botNameFromStorage = () => {
  try {
    const u = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
    return u?.persona === 'aarav' || u?.persona === 'aastik' ? 'Aastik' : 'Aastha';
  } catch { return 'Aastha'; }
};

let lastSync = 0;

export const followUpCheckIns = {
  async sync(force = false) {
    if (!isNative()) return;
    if (!force && Date.now() - lastSync < 10 * 60_000) return; // resume fires often
    lastSync = Date.now();
    let upcoming: UpcomingCheckIn[] = [];
    let letterAt: string | null = null;
    try {
      const res = await api.get('/users/reach-out', { params: { tz: deviceTimeZone() } });
      upcoming = res.data?.enabled === false ? [] : (res.data?.upcoming || []);
      letterAt = res.data?.weeklyLetter?.enabled === false ? null : (res.data?.weeklyLetter?.nextAt || null);
    } catch {
      return; // offline / logged out, keep whatever is scheduled
    }
    // Weekly letter (server writes it Sunday evening; the phone has no server push, so we announce it ourselves)
    await cancelIds([NOTIF_IDS.WEEKLY_LETTER]);
    if (letterAt && new Date(letterAt).getTime() > Date.now() && (await hasPermission())) {
      const bot = botNameFromStorage();
      try { await scheduleOne({ id: NOTIF_IDS.WEEKLY_LETTER, title: `${bot} wrote you a letter 💌`, body: 'About your week. Open when you have a quiet minute.', at: new Date(letterAt) }); } catch { /* ignore */ }
    }
    await cancelIds(NOTIF_IDS.FOLLOW_UP);
    if (!upcoming.length || !(await hasPermission())) return;
    const ids = NOTIF_IDS.FOLLOW_UP;
    for (let i = 0; i < Math.min(ids.length, upcoming.length); i++) {
      const c = upcoming[i];
      const at = new Date(c.at);
      if (!(at.getTime() > Date.now())) continue;
      try { await scheduleOne({ id: ids[i], title: c.title, body: c.body, at }); } catch { /* ignore */ }
    }
  },
  async cancelAll() {
    lastSync = 0;
    await cancelIds(NOTIF_IDS.FOLLOW_UP);
  },
  /** The letter was opened/arrived: drop the pending "she wrote you a letter" notification. */
  async letterArrived() { await cancelIds([NOTIF_IDS.WEEKLY_LETTER]); },
};

if (typeof window !== 'undefined') {
  // ChatView fires this after a crisis message so pending check-ins are cancelled right away
  window.addEventListener('aastha:reach-out-refresh', () => { followUpCheckIns.sync(true).catch(() => {}); });
}
