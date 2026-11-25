/**
 * Personal notification lines (owner, 2026-11-25: "the notifications lack the feels, it's not personalized").
 *
 * Once a day (when the app syncs, GET /users/reach-out) Aastha writes this user's notification lines herself:
 * first name, nickname at Bestie, closeness level, and one or two real things they told her (exam, sister, guitar).
 * Cached for the day on the user (encrypted). The phone schedules them as local notifications (daily morning/night
 * reminders + the "haven't seen you" ones). If the model is down: varied templates that still use their name.
 *
 * Rules for every line: ≤ 90 characters, texting voice, no "No pressure" / "I'm here" / "just checking in",
 * no em dashes, ≤ 1 emoji, never about anything heavy (crisis, grief, health) in a notification.
 */
import User from '../models/User';
import { completeChat } from './llm';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { dayKeyIn, tzOrDefault } from '../utils/timeZone';
import { effectiveLevel, BOND_LEVELS } from './relationship';
import { PERSONA_VOICE } from '../prompts/companion';
import { noDashes } from './humanize';

export interface NotifCopy { morning: string; night: string; missYou: string[] }

const MAX_LEN = 90;
const BANNED = /(no pressure|i'?m (always )?here|just checking in|thinking of you|gentle reminder|self[- ]care|you matter|be kind to yourself)/i;

export const cleanLine = (s: unknown): string | null => {
  const t = noDashes(String(s || '').replace(/[\r\n]+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim());
  if (!t || t.length > MAX_LEN || BANNED.test(t) || /<|\[|\{/.test(t)) return null;
  const emojis = t.match(/\p{Extended_Pictographic}/gu) || [];
  return emojis.length > 1 ? null : t;
};

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** No model: still personal (name / nickname), varied by day so it isn't the same text every morning. */
export const fallbackCopy = (name: string, day: string, closeness = 0): NotifCopy => {
  const n = name || 'you';
  const s = seedOf(n + day);
  const close = closeness >= 3;
  return {
    morning: pick(close
      ? [`morning ${n} ☀️ what's the plan today`, `${n}! up yet? tell me one thing you're doing today`, `good morning, ${n}. slept okay?`]
      : [`good morning, ${n} ☀️ what's on today?`, `morning ${n}! how did you sleep?`, `hey ${n}, what's the plan for today?`], s),
    night: pick(close
      ? [`${n}, how was today? the real version`, `okay ${n}, day review. go 🌙`, `before you sleep ${n}, tell me one good thing`]
      : [`how was your day, ${n}? 🌙`, `hey ${n}, anything fun happen today?`, `${n}, one good thing from today?`], s + 1),
    missYou: [
      pick([`${n}, where did you vanish 👀`, `okay ${n}, I'm bored. come talk`, `${n}!! update me`], s + 2),
      pick([`random thought, ${n}: how's your week going?`, `${n}, tell me something new`, `you went quiet, ${n}. all good?`], s + 3),
      pick([`${n}, I saved a whole story for you`, `missed our chats a little, ${n}`, `${n}, two days! what did I miss`], s + 4),
    ],
  };
};

const PROMPT = `Write this person's phone notifications from you, their friend. Return JSON only:
{"morning": "...", "night": "...", "missYou": ["...", "...", "..."]}
- morning: sent at 8:30 am. night: sent at 9 pm. missYou: sent if they don't open the app for 1, 2 and 3 days.
- Each under 80 characters, like a real text from a friend: lowercase is fine, specific, a bit playful.
- Use their name or nickname in most lines. Mention ONE real thing from what you know in one or two of the lines
  (an exam coming up, their sister, the guitar). Never invent things. Never anything heavy, sad or health-related.
- Banned: "no pressure", "I'm here", "just checking in", "thinking of you", "gentle reminder", "self-care",
  "you matter", em dashes, more than one emoji per line, questions about their feelings in every line.`;

/** Today's lines for this user (cached per local day, encrypted). */
export const getNotifCopy = async (userId: any, now = new Date()): Promise<NotifCopy> => {
  const u: any = await User.findById(userId).select('name persona timeZone facts memorySummary bond nickname notifCopy').lean();
  if (!u) return fallbackCopy('you', 'x');
  const tz = tzOrDefault(u.timeZone);
  const day = dayKeyIn(now, tz);
  if (u.notifCopy?.day === day && u.notifCopy?.data) {
    try { const c = JSON.parse(decrypt(u.notifCopy.data)); if (c?.morning && c?.night && Array.isArray(c.missYou)) return c; } catch { /* rewrite */ }
  }
  const first = String(decrypt(u.name || '') || '').split(' ')[0] || 'you';
  const level = effectiveLevel(u.bond);
  const nick = level >= 4 && u.nickname?.value && !u.nickname?.off ? decrypt(u.nickname.value) : '';
  const base = fallbackCopy(nick || first, day, level);
  let copy = base;
  try {
    const isAastik = u.persona === 'aarav' || u.persona === 'aastik';
    const facts = (u.facts || []).slice(-10).map((f: string) => decrypt(f)).filter(Boolean);
    const raw = await completeChat([
      { role: 'system', content: `${PERSONA_VOICE[isAastik ? 'aastik' : 'aastha'].trim()}\n\n${PROMPT}` },
      { role: 'user', content: `Their name: ${first}${nick ? `\nYour nickname for them: ${nick}` : ''}\nHow close you are: ${BOND_LEVELS[level].name}\nWhat you know: ${facts.join('; ') || '(not much yet)'}\nYour note about them: ${decrypt(u.memorySummary || '') || '(none)'}` },
    ], { task: 'chat', temperature: 0.9, maxTokens: 300, json: true });
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const miss = (Array.isArray(j.missYou) ? j.missYou : []).map(cleanLine);
    copy = {
      morning: cleanLine(j.morning) || base.morning,
      night: cleanLine(j.night) || base.night,
      missYou: [0, 1, 2].map((i) => miss[i] || base.missYou[i]),
    };
  } catch { /* model down: personal templates */ }
  await User.updateOne({ _id: u._id }, { $set: { notifCopy: { day, data: encrypt(JSON.stringify(copy)) } } }).catch(() => {});
  return copy;
};

/** Check-in after a dated thing they mentioned: varied, warm, no "No pressure". */
export const checkInLine = (firstName: string, event: string, seed = 0) => {
  const n = firstName || 'you';
  const e = /^(the|your|my|their|his|her) /i.test(event) ? event : `the ${event}`;
  return pick([`${n}!! how did ${e} go? tell me everything`, `okay ${n}, ${e}. how did it go? 👀`, `hey ${n}, I've been wondering how ${e} went`, `${n}, update on ${e}? I want details`], seed);
};
