import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

const NOTIFICATION_ENABLED_KEY = 'notifications_enabled';

export const notificationService = {
    async init() {
        // Request permissions on init if not already granted
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'prompt') {
           // We don't auto-prompt on init to avoid annoyance, user must enable in settings
        }
    },

    async requestPermission(): Promise<boolean> {
        const result = await LocalNotifications.requestPermissions();
        if (result.display === 'granted') {
            await Preferences.set({ key: NOTIFICATION_ENABLED_KEY, value: 'true' });
            this.scheduleDailyReminders();
            return true;
        }
        return false;
    },

    async scheduleDailyReminders() {
        // Clear existing to avoid duplicates
        await LocalNotifications.cancel(await LocalNotifications.getPending());

        // Schedule for 9 PM
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: "How was your day? 🌙",
                    body: "Aastha is here to listen. Take a moment to reflect.",
                    id: 1,
                    schedule: {
                        on: { hour: 21, minute: 0 },
                        allowWhileIdle: true
                    }
                },
                {
                     title: "Good Morning ☀️",
                     body: "Start your day with intention. Aastha is with you.",
                     id: 2,
                     schedule: {
                         on: { hour: 8, minute: 30 },
                         allowWhileIdle: true
                     }
                }
            ]
        });
    },

    async disable() {
        await LocalNotifications.cancel(await LocalNotifications.getPending());
        await Preferences.set({ key: NOTIFICATION_ENABLED_KEY, value: 'false' });
    }
};
