/**
 * Web Push for browser / installed-PWA users (no Firebase). Pairs with public/push-sw.js and
 * server/src/services/webPush.ts. Native Android uses local notifications instead.
 * iPhone: only works when Aastha is added to the Home Screen (iOS 16.4+).
 */
import { Capacitor } from '@capacitor/core';
import api from './api';

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const webPush = {
  isSupported(): boolean {
    return (
      !Capacitor.isNativePlatform() &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /** iPhone/iPad Safari needs the site installed to the Home Screen first. */
  needsHomeScreenInstall(): boolean {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone;
    return isIOS && !standalone;
  },

  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(await reg?.pushManager.getSubscription());
  },

  /** Returns 'subscribed' | 'denied' | 'unsupported' | 'not-configured' | 'error'. */
  async subscribe(): Promise<'subscribed' | 'denied' | 'unsupported' | 'not-configured' | 'error'> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';

      const keyRes = await api.get('/users/push/key').catch((e) => e?.response);
      if (!keyRes || keyRes.status !== 200 || !keyRes.data?.publicKey) return 'not-configured';

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey),
        }));
      await api.post('/users/push/subscribe', { subscription: sub.toJSON() });
      return 'subscribed';
    } catch (e) {
      console.error('[WebPush] subscribe failed', e);
      return 'error';
    }
  },

  async unsubscribe(): Promise<void> {
    if (!this.isSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api.post('/users/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  },

  async sendTest(): Promise<boolean> {
    const res = await api.post('/users/push/test').catch(() => null);
    return !!res?.data?.success;
  },
};
