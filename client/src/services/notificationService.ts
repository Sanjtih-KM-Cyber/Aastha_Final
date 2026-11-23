import { Preferences } from '@capacitor/preferences';
import { NOTIF_IDS, cancelIds, ensureChannels, requestPermission, scheduleOne, isNative } from './notifications';

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

    async scheduleDailyReminders() {
        await cancelIds([NOTIF_IDS.DAILY_EVENING, NOTIF_IDS.DAILY_MORNING]);
        await scheduleOne({
            id: NOTIF_IDS.DAILY_EVENING,
            title: "How was your day? 🌙",
            body: "No pressure, if you feel like talking it out, I'm here.",
            every: { hour: 21, minute: 0 },
        });
        await scheduleOne({
            id: NOTIF_IDS.DAILY_MORNING,
            title: "Good morning ☀️",
            body: "Wishing you an easy day. I'm around if you need me.",
            every: { hour: 8, minute: 30 },
        });
    },

    async disable() {
        await cancelIds([NOTIF_IDS.DAILY_EVENING, NOTIF_IDS.DAILY_MORNING]);
        await Preferences.set({ key: NOTIFICATION_ENABLED_KEY, value: 'false' });
    }
};
