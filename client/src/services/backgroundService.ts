import { Capacitor } from '@capacitor/core';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';

class BackgroundService {
  private activeReasons = new Set<string>();

  async init() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Check permissions
      // We might need to request them.
      // The plugin should handle basic setup, but let's be safe.
      const permissions = await BackgroundMode.checkNotificationsPermission();
      if (permissions.display !== 'granted') {
        await BackgroundMode.requestNotificationsPermission();
      }
    } catch (error) {
      console.error('BackgroundService init error:', error);
    }
  }

  /**
   * Enables background mode.
   * @param reason - Unique key for the feature requesting background mode (e.g., 'pomodoro', 'music')
   * @param title - Notification title
   * @param body - Notification body
   */
  async enable(reason: string, title: string = 'Aastha is active', body: string = 'Keeping your session alive...') {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.activeReasons.add(reason);

      await BackgroundMode.setSettings({
        title,
        text: body,
        silent: false,
        hidden: false,
        allowClose: false,
        color: '1c1c1e',
      });

      await BackgroundMode.enable();

      // Disable battery optimizations to ensure it keeps running
      const battery = await BackgroundMode.checkBatteryOptimizations();
      if (!battery.disabled) {
          // Optional: Request if critical
      }

    } catch (error) {
      console.error('BackgroundService enable error:', error);
    }
  }

  /**
   * Disables background mode for a specific feature.
   * Only actually disables the native plugin if no other features are using it.
   */
  async disable(reason: string) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.activeReasons.delete(reason);

      if (this.activeReasons.size === 0) {
          await BackgroundMode.disable();
      }
    } catch (error) {
      console.error('BackgroundService disable error:', error);
    }
  }

  async updateNotification(title: string, body: string) {
    // We only update if active.
    // NOTE: This updates the shared notification. If multiple services are active,
    // the last one to call this wins. This is acceptable for now.
    if (!Capacitor.isNativePlatform() || this.activeReasons.size === 0) return;

    try {
      await BackgroundMode.setSettings({
        title,
        text: body
      });
    } catch (error) {
      console.error('BackgroundService update notification error:', error);
    }
  }

  isActive() {
    return this.activeReasons.size > 0;
  }
}

export const backgroundService = new BackgroundService();
