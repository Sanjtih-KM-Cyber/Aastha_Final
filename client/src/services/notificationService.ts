import { Preferences } from '@capacitor/preferences';
import { NOTIF_IDS, cancelIds, ensureChannels, requestPermission, scheduleOne, isNative, savedNotifCopy } from './notifications';

const botName = () => {
    try {
        const u = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
        return u?.persona === 'aarav' || u?.persona === 'aastik' ? 'Aastik' : 'Aastha';
    } catch { return 'Aastha'; }
};

const NOTIFICATION_ENABLED_KEY = 'notifications_enabled';

/** Daily morning/evening reminders (opt-in from Settings). Only touches its own IDs. */
export const notificationService = {
    async init() {
        if (!isNative()) return;
        await ensureChannels();
        // Re-schedule on launch if the user opted in (keeps reminders alive after updates/reinstalls)
        const { value } = await Preferences.get({ key: NOTIFICATION_ENABLED_KEY });
        if (value === 'true') await this.scheduleDailyReminders();
    },

    async requestPermission(): Promise<boolean> {
        const granted = await requestPermission();
        if (granted) {
            await Preferences.set({ key: NOTIFICATION_ENABLED_KEY, value: 'true' });
            await this.scheduleDailyReminders();
        }
        return granted;
    },

    /** Morning 8:30 + night 21:00, in Aastha's own words for this person (refreshed daily by followUpCheckIns.sync). */
    async scheduleDailyReminders() {
        await cancelIds([NOTIF_IDS.DAILY_EVENING, NOTIF_IDS.DAILY_MORNING]);
        const c = savedNotifCopy();
        const bot = botName();
        await scheduleOne({
            id: NOTIF_IDS.DAILY_EVENING,
            title: bot,
            body: c?.night || "how was today? tell me the real version 🌙",
            every: { hour: 21, minute: 0 },
        });
        await scheduleOne({
            id: NOTIF_IDS.DAILY_MORNING,
            title: bot,
            body: c?.morning || "good morning ☀️ what's on today?",
            every: { hour: 8, minute: 30 },
        });
    },
    async isEnabled() { return (await Preferences.get({ key: NOTIFICATION_ENABLED_KEY })).value === 'true'; },

    async disable() {
        await cancelIds([NOTIF_IDS.DAILY_EVENING, NOTIF_IDS.DAILY_MORNING]);
        await Preferences.set({ key: NOTIFICATION_ENABLED_KEY, value: 'false' });
    }
};
