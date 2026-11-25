import { Capacitor } from '@capacitor/core';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';

const BATTERY_ASKED_KEY = 'aastha_battery_prompt_shown';

class BackgroundService {
  // Store reason -> "Title: Body" or just custom object to reconstruct message
  private reasons = new Map<string, { title: string, body: string }>();

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

  /** Only music is keeping us in the background (its media notification is enough). */
  private onlyMusic() {
      return this.reasons.size > 0 && [...this.reasons.keys()].every((r) => r === 'jam');
  }

  private generateNotificationContent() {
      // Prioritize content: Pomodoro takes precedence for "Title" usually, or merge them.
      // Logic:
      // Title: "Aastha Active" (Generic) or specific if single.
      // Body: "Focus: 20m | Jam: LoFi Beats"

      const items = Array.from(this.reasons.values());

      if (items.length === 0) return { title: 'Aastha', body: 'Background service active' };

      if (items.length === 1) {
          return items[0];
      }

      // Multiple reasons -> Merge
      // Title: Combine Titles or use generic? Let's use generic to avoid clutter.
      // Body: Combine Bodies.

      // Let's try to be smart.
      // If Pomodoro is active, Title = "Focus Session".
      // If Jam is active, Title = "Music Playing".
      // Combined: "Focus & Music"

      const uniqueTitles = Array.from(new Set(items.map(i => i.title)));
      const title = uniqueTitles.join(' & ');
      const body = items.map(i => i.body).join(' • ');

      return { title, body };
  }

  private async refreshNotification(silent = true) {
      if (!Capacitor.isNativePlatform()) return;
      if (this.reasons.size === 0) return;

      const content = this.generateNotificationContent();

      try {
          await BackgroundMode.setSettings({
              title: content.title,
              text: content.body,
              silent: silent,
              hidden: this.onlyMusic(), // music has its own player notification
              bigText: true,  // Helps Android identify as media
              allowClose: false,
              color: '1c1c1e',
          });
      } catch (e) {
          console.error("[BackgroundService] Failed to refresh notification", e);
      }
  }

  /**
   * Enable background mode for a specific feature.
   * @param reason Unique ID (e.g., 'pomodoro', 'jam')
   * @param title Notification Title (e.g., 'Focus Timer')
   * @param body Notification Body (e.g., '25:00 remaining')
   */
  async enable(reason: string, title: string = 'Aastha Active', body: string = 'Running...') {
    if (!Capacitor.isNativePlatform()) return;

    console.log(`[BackgroundService] Enable called for: ${reason}`);
    this.reasons.set(reason, { title, body });

    // If already active, just update text (silent)
    // If first time, enable (not silent to ensure it appears?) -> typically silent is better to avoid "Ding" every time track changes.
    // The very first time, the OS handles the appearance.

    const isFirst = (this.reasons.size === 1);

    try {
        const content = this.generateNotificationContent();

        await BackgroundMode.setSettings({
            title: content.title,
            text: content.body,
            silent: !isFirst, // Only sound/vibrate on first activation if needed, but usually better silent always for updates
            // Music has its own player notification (services/mediaControls.ts): don't show a second one while music
            // is the only thing running (Android shows a hidden keep-alive at minimum priority, out of the way)
            hidden: this.onlyMusic(),
            allowClose: false,
            color: '1c1c1e',
            // THE fix for "music stops when I switch apps" (2026-11-25): Android tells the WebView it's hidden when the
            // app goes to the background and the YouTube player pauses itself. This keeps the WebView "visible"
            // while a background reason (music, sounds, focus timer) is active.
            disableWebViewOptimization: true,
        });

        await BackgroundMode.enable();
        try { await BackgroundMode.disableWebViewOptimizations(); } catch { /* older plugin builds: setting above */ }

        // Keeping the WebView awake only works when Android doesn't battery-optimise the app. The first time music
        // plays, show Android's own "Let Aastha always run in the background?" prompt, once (never again if they say no).
        if (isFirst && reason === 'jam') {
             try {
                const battery = await BackgroundMode.checkBatteryOptimizations();
                const asked = localStorage.getItem(BATTERY_ASKED_KEY) === '1';
                if (!battery.disabled && !asked) {
                    localStorage.setItem(BATTERY_ASKED_KEY, '1');
                    await BackgroundMode.requestDisableBatteryOptimizations();
                }
             } catch (e) { /* not supported on this phone */ }
        }

    } catch (error) {
      console.error('[BackgroundService] enable error:', error);
    }
  }

  async disable(reason: string) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      console.log(`[BackgroundService] Disable called for: ${reason}`);
      const existed = this.reasons.delete(reason);

      if (this.reasons.size === 0) {
          console.log("[BackgroundService] No active reasons, disabling.");
          try { await BackgroundMode.enableWebViewOptimizations(); } catch { /* ignore */ } // normal battery behaviour again
          await BackgroundMode.disable();
      } else if (existed) {
          // Update notification to remove the disabled item text
          await this.refreshNotification(true);
      }
    } catch (error) {
      console.error('[BackgroundService] disable error:', error);
    }
  }

  /**
   * Update the status text for a specific feature without re-enabling.
   */
  async updateReason(reason: string, title: string, body: string) {
      if (!Capacitor.isNativePlatform()) return;
      if (!this.reasons.has(reason)) return; // Don't update if not active

      this.reasons.set(reason, { title, body });
      await this.refreshNotification(true);
  }

  // Deprecated: kept for backward compat if needed, but redirects to 'general'
  async updateNotification(title: string, body: string) {
    console.warn("[BackgroundService] updateNotification is deprecated. Use updateReason.");
    // We don't know which reason this is for, so we can't safely update.
    // Ideally, we force migration.
  }

  isActive() {
    return this.reasons.size > 0;
  }
}

export const backgroundService = new BackgroundService();
