import { Capacitor } from '@capacitor/core';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';

class BackgroundService {
  private activeReasons = new Set<string>();

  async init() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const permissions = await BackgroundMode.checkNotificationsPermission();
      if (permissions.display !== 'granted') {
        await BackgroundMode.requestNotificationsPermission();
      }
    } catch (error) {
      console.error('BackgroundService init error:', error);
    }
  }

  async enable(reason: string, title: string = 'Aastha is active', body: string = 'Keeping your session alive...') {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.activeReasons.add(reason);

      await BackgroundMode.setSettings({
        title,
        text: body,
        silent: false,
        hidden: false,
        allowClose: false, // ✅ Critical: Makes it "Sticky"
        color: '1c1c1e',
      });

      await BackgroundMode.enable();

      const battery = await BackgroundMode.checkBatteryOptimizations();
      if (!battery.disabled) {
          // Optional: Request to disable optimizations
      }

    } catch (error) {
      console.error('BackgroundService enable error:', error);
    }
  }

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
    if (!Capacitor.isNativePlatform() || this.activeReasons.size === 0) return;

    try {
      // ✅ FIX: Re-apply 'allowClose: false' on every update.
      // Without this, updating the text resets the notification to be dismissible.
      await BackgroundMode.setSettings({
        title,
        text: body,
        allowClose: false, 
        silent: true 
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
