/**
 * Single place for local-notification IDs, channels and icon (ROADMAP M3, M5, M9).
 *
 * Every feature owns a fixed ID range and only ever cancels ITS OWN IDs.
 * (Before: the ghost scheduler and the daily reminders each cancelled *all* pending notifications,
 *  wiping each other and any running Pomodoro alert.)
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const NOTIF_IDS = {
  DAILY_EVENING: 1,
  DAILY_MORNING: 2,
  GHOST: [1001, 1002, 1003],
  POMODORO_DONE: 3001,
  FOLLOW_UP: [2001, 2002, 2003, 2004, 2005], // "Aastha reaches out first" (services/followUpCheckIns.ts)
  SEEN_NUDGE: 4001, // left the reply on seen and closed the app (services/seenNudge.ts)
  WEEKLY_LETTER: 4101, // "Aastha wrote you a letter" on Sunday evening (services/followUpCheckIns.ts)
} as const;

export const CHANNELS = {
  DEFAULT: 'aastha_default',   // check-ins, reminders
  PRIVATE: 'aastha_private',   // same, but Android hides the text on a locked screen ("Contents hidden")
  TIMERS: 'pop_notifications', // focus / break alerts (kept id for existing installs)
} as const;

/** White, transparent-background status-bar icon in android/app/src/main/res/drawable */
export const SMALL_ICON = 'ic_stat_aastha';

export const isNative = () => Capacitor.isNativePlatform();

// "Hide notification text on the lock screen" (2026-11-24): saved on the account (web push uses it server-side);
// this device copy picks the private channel for everything we schedule from now on.
const PRIVATE_KEY = 'notif-private';
export const privateNotifications = () => { try { return localStorage.getItem(PRIVATE_KEY) === 'true'; } catch { return false; } };
export const setPrivateNotificationsLocal = (on: boolean) => { try { localStorage.setItem(PRIVATE_KEY, String(on)); } catch { /* ignore */ } };

export const cancelIds = async (ids: readonly number[]) => {
  if (!isNative() || ids.length === 0) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* nothing scheduled */
  }
};

export const ensureChannels = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNELS.DEFAULT,
      name: 'Check-ins & reminders',
      description: 'Gentle check-ins and your daily reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    // Android channel visibility can't change after creation, so "hide text on lock screen" is its own channel
    await LocalNotifications.createChannel({
      id: CHANNELS.PRIVATE,
      name: 'Check-ins & reminders (private)',
      description: 'Text hidden on the lock screen until you unlock',
      importance: 4,
      visibility: 0,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: CHANNELS.TIMERS,
      name: 'Focus timer',
      description: 'Focus and break alerts',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('[Notifications] channel setup failed', e);
  }
};

export const hasPermission = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
};

export const requestPermission = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch {
    return false;
  }
};

/**
 * Android 12+: without "Alarms & reminders" access, scheduled notifications are batched/delayed
 * (often by hours on battery-saving phones). Returns true if exact alarms are allowed.
 */
export const exactAlarmsAllowed = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return true;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true; // older Android / plugin: nothing to ask for
  }
};

/** Opens the system "Alarms & reminders" screen for this app. */
export const openExactAlarmSettings = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch (e) {
    console.warn('[Notifications] cannot open exact alarm settings', e);
  }
};

/** Schedules one notification on the right channel with the right icon. */
export const scheduleOne = async (n: {
  id: number;
  title: string;
  body: string;
  at?: Date;
  every?: { hour: number; minute: number };
  channel?: string;
}) => {
  if (!isNative()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: n.id,
        title: n.title,
        body: n.body,
        smallIcon: SMALL_ICON,
        channelId: (n.channel || CHANNELS.DEFAULT) === CHANNELS.DEFAULT && privateNotifications() ? CHANNELS.PRIVATE : (n.channel || CHANNELS.DEFAULT),
        schedule: n.every
          ? { on: { hour: n.every.hour, minute: n.every.minute }, allowWhileIdle: true }
          : { at: n.at || new Date(), allowWhileIdle: true },
      },
    ],
  });
};
