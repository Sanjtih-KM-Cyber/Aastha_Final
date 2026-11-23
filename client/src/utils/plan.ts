/**
 * The credits pill in the chat header (7.1). It used to say "16 Premium" on the Free plan.
 * Free = 16 messages per rolling 24 h (the window starts with the first message — server clock only);
 * after that replies continue in Eco mode until the refill time (`quotaResetsAt` from the server).
 */
export const FREE_DAILY_MESSAGES = 16;

export interface PlanInfo {
  isPro?: boolean;
  subscriptionExpiresAt?: string | null;
  voicePassExpiresAt?: string | null;
}

export type PlanKind = 'pro' | 'voice' | 'free' | 'eco';

const active = (iso?: string | null, now = Date.now()) => !!iso && new Date(iso).getTime() > now;

export const formatUntil = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined, hour12: true }).replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toLowerCase());
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return time;
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const planLabel = (plan: PlanInfo | null | undefined, messagesLeft: number, now = new Date(), resetsAt?: string | null): { kind: PlanKind; text: string; short: string; hint?: string } => {
  const t = now.getTime();
  if (plan?.isPro || active(plan?.subscriptionExpiresAt, t)) return { kind: 'pro', text: 'Pro', short: 'Pro' };
  if (active(plan?.voicePassExpiresAt, t)) return { kind: 'voice', text: `Voice Pass until ${formatUntil(plan!.voicePassExpiresAt!, now)}`, short: 'Voice Pass' };
  const left = Number.isFinite(messagesLeft) ? Math.max(0, Math.min(FREE_DAILY_MESSAGES, Math.floor(messagesLeft))) : 0;
  const refill = resetsAt && Date.parse(resetsAt) > now.getTime() ? `Refills at ${formatUntil(resetsAt, now)}` : '';
  if (left <= 0) return { kind: 'eco', text: refill ? `Eco mode · ${refill.toLowerCase()}` : 'Eco mode', short: refill || 'Eco', hint: refill || undefined };
  return { kind: 'free', text: `${left} message${left === 1 ? '' : 's'} left`, short: `${left} left`, hint: refill ? `${refill} (16 messages every 24 h)` : '16 messages every 24 h' };
};
