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
        silent: true, // Set to true to avoid sound/vibration on start (optional)
        hidden: false,
        allowClose: false, // ✅ CRITICAL: Makes notification sticky (cannot be swiped)
        color: '1c1c1e',
      });

      await BackgroundMode.enable();

      // Optimize battery settings if needed
      const battery = await BackgroundMode.checkBatteryOptimizations();
      if (!battery.disabled) {
          // You could request to disable optimizations here if needed
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
      // ✅ CRITICAL FIX: Re-apply 'allowClose: false' on every update
      // Otherwise, the update might reset it to true (dismissible).
      await BackgroundMode.setSettings({
        title,
        text: body,
        allowClose: false, // Keep it sticky
        silent: true // Keep it silent (no vibration every second)
      });
    } catch (error) {
      console.error('BackgroundService update notification error:', error);
    }
  }

  isActive() {
    return this.activeReasons.size > 0;
  }
}

// Singleton Instance
export const backgroundService = new BackgroundService();
