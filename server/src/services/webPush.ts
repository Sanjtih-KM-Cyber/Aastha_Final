/**
 * Web Push for browser / installed-PWA users, no Firebase needed (VAPID keys only). ROADMAP M4 (web part).
 * The native Android app still needs FCM (Firebase) for server push; it uses local notifications meanwhile.
 *
 * Setup (once):  npx web-push generate-vapid-keys
 *   → set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com) on Render.
 */
import webpush from 'web-push';
import User from '../models/User';

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@aasthaai.site';

export const MAX_SUBSCRIPTIONS_PER_USER = 5;
let configured = false;

export const isWebPushConfigured = (): boolean => {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch (e: any) {
    console.error('[WebPush] Invalid VAPID configuration:', e?.message);
  }
  return configured;
};

export const getPublicKey = () => (isWebPushConfigured() ? PUBLIC : null);

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Basic validation: push endpoints must be https URLs and keys present. */
export const isValidSubscription = (s: any): s is PushSub =>
  !!s &&
  typeof s.endpoint === 'string' &&
  /^https:\/\//.test(s.endpoint) &&
  s.endpoint.length < 1000 &&
  typeof s.keys?.p256dh === 'string' &&
  typeof s.keys?.auth === 'string';

export const addSubscription = async (userId: string, sub: PushSub, userAgent?: string) => {
  const user = await User.findById(userId).select('pushSubscriptions');
  if (!user) return;
  const list = ((user as any).pushSubscriptions || []).filter((s: any) => s.endpoint !== sub.endpoint);
  list.push({ endpoint: sub.endpoint, keys: sub.keys, userAgent: (userAgent || '').slice(0, 200), createdAt: new Date() });
  (user as any).pushSubscriptions = list.slice(-MAX_SUBSCRIPTIONS_PER_USER);
  await user.save();
};

export const removeSubscription = (userId: string, endpoint: string) =>
  User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint } } });

/**
 * Sends to every browser the user subscribed. Expired subscriptions (404/410) are removed.
 * Returns how many deliveries the push services accepted.
 */
export const sendToUser = async (userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<number> => {
  if (!isWebPushConfigured()) return 0;
  const user = await User.findById(userId).select('pushSubscriptions').lean();
  const subs: any[] = (user as any)?.pushSubscriptions || [];
  let delivered = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/sanctuary', tag: payload.tag || 'aastha' }),
          { TTL: 60 * 60 * 24, urgency: 'normal' }
        );
        delivered++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await removeSubscription(userId, s.endpoint);
        } else {
          console.warn('[WebPush] send failed:', err?.statusCode, String(err?.body || err?.message).slice(0, 120));
        }
      }
    })
  );
  return delivered;
};
