import { Capacitor } from '@capacitor/core';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';

class BackgroundService {
  private activeReasons = new Set<string>();

  constructor() {
    console.log("[BackgroundService] Instance created");
  }

  async init() {
    if (!Capacitor.isNativePlatform()) {
        console.log("[BackgroundService] Not native platform, skipping init");
        return;
    }

    try {
      console.log("[BackgroundService] Initializing...");
      const permissions = await BackgroundMode.checkNotificationsPermission();
      if (permissions.display !== 'granted') {
        await BackgroundMode.requestNotificationsPermission();
      }
      console.log("[BackgroundService] Init complete");
    } catch (error) {
      console.error('[BackgroundService] init error:', error);
    }
  }

  async enable(reason: string, title: string = 'Aastha is active', body: string = 'Keeping your session alive...') {
    if (!Capacitor.isNativePlatform()) return;

    try {
      console.log(`[BackgroundService] Enable called for: ${reason}`);
      this.activeReasons.add(reason);

      // Common settings for all modes
      await BackgroundMode.setSettings({
        title,
        text: body,
        silent: false, // We want sound/vibration for initial notification potentially, or at least visibility
        hidden: false,
        allowClose: false, // Sticky
        color: '1c1c1e',
      });

      await BackgroundMode.enable();

      // Check battery optimizations (optional but recommended)
      try {
          const battery = await BackgroundMode.checkBatteryOptimizations();
          if (!battery.disabled) {
              console.log("[BackgroundService] Battery optimizations are enabled, might affect background performance.");
              // We could request to disable, but it might be annoying to prompt every time.
              // await BackgroundMode.requestDisableBatteryOptimizations();
          }
      } catch (battErr) {
          console.warn("[BackgroundService] Battery check failed", battErr);
      }

    } catch (error) {
      console.error('[BackgroundService] enable error:', error);
    }
  }

  async disable(reason: string) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      console.log(`[BackgroundService] Disable called for: ${reason}`);
      this.activeReasons.delete(reason);

      if (this.activeReasons.size === 0) {
          console.log("[BackgroundService] No active reasons, disabling background mode");
          await BackgroundMode.disable();
      } else {
          console.log(`[BackgroundService] Remaining reasons: ${Array.from(this.activeReasons).join(', ')}`);
      }
    } catch (error) {
      console.error('[BackgroundService] disable error:', error);
    }
  }

  async updateNotification(title: string, body: string) {
    if (!Capacitor.isNativePlatform()) return;

    // Safety check: Only update if we are actually tracking reasons
    if (this.activeReasons.size === 0) return;

    try {
      await BackgroundMode.setSettings({
        title,
        text: body,
        allowClose: false, // Maintain stickiness
        silent: true // Silent updates to avoid spamming sound
      });
    } catch (error) {
      console.error('[BackgroundService] update notification error:', error);
    }
  }

  isActive() {
    return this.activeReasons.size > 0;
  }
}

export const backgroundService = new BackgroundService();
