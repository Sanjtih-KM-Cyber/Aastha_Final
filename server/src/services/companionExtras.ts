/**
 * Small companion features that each need one short LLM call:
 *  - suggestReplies   → reply chips written in the USER's voice, generated from the companion's actual reply
 *  - makeNickname     → a unique nickname at Bestie level, from their name / what they shared
 *  - nudge prompt     → one short follow-up when they reacted (or left the companion on seen) and went quiet
 * Every call is time-boxed and fails soft (no chips / no nickname / no nudge), never blocks the chat.
 */
import { completeChat } from './llm';

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const parseJson = (raw: string | null): any => {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\r\n<>{}`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ── Reply chips ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * 2–3 short things the USER could send next, in reply to `reply`. Written as the user (first person = the user),
 * in the user's language/style. Chips that read like the companion talking are dropped.
 */
export const suggestReplies = async (opts: { botName: string; userText: string; reply: string; ms?: number }): Promise<string[]> => {
  const { botName, userText, reply } = opts;
  if (!reply.trim()) return [];
  const raw = await withTimeout(completeChat([
    {
      role: 'system',
      content: `You write quick-reply buttons for a chat app. The USER is texting their friend ${botName} (an AI companion).
Write 3 short replies the USER could tap to answer ${botName}'s last message.
- Written BY the user, TO ${botName}. "I"/"me" = the user. Never write as ${botName}, never apologise on ${botName}'s behalf.
- Same language, script and texting style as the user's own message (lowercase/slang/Hinglish if they use it).
- 2–6 words each, varied (e.g. one answer, one reaction, one change of topic). No emojis unless the user uses them. No quotes.
Return JSON only: {"replies":["…","…","…"]}`,
    },
    { role: 'user', content: `User's message: ${clean(userText, 400)}\n${botName}'s reply: ${clean(reply, 900)}` },
  ], { task: 'brain', temperature: 0.8, maxTokens: 150 } as any), opts.ms ?? 3500);
  const list: unknown[] = parseJson(raw as any)?.replies || [];
  const bot = botName.toLowerCase();
  const seen = new Set<string>();
  return list
    .map((r) => clean(r, 40))
    .filter((r) => {
      const low = r.toLowerCase();
      if (r.length < 2 || seen.has(low)) return false;
      seen.add(low);
      // drop chips that are clearly the companion speaking
      if (low.includes(`i'm ${bot}`) || low.includes(`i am ${bot}`) || /\b(my bad|i'm here for you|i'm all ears|how can i help|let me know)\b/.test(low)) return false;
      return true;
    })
    .slice(0, 3);
};

// ── Nicknames (Bestie level) ────────────────────────────────────────────────────────────────────────────
const GENERIC = ['buddy', 'champ', 'dear', 'bestie', 'sunshine', 'friend', 'pal', 'bro', 'sis', 'babe', 'baby', 'honey', 'sweetie', 'love', 'darling', 'jaan'];

export const isOkNickname = (n: string) => {
  const s = clean(n, 24);
  if (s.length < 2 || s.length > 20 || s.split(' ').length > 3) return false;
  if (GENERIC.includes(s.toLowerCase())) return false;
  if (/[0-9@#$%^*_=+|\\/]/.test(s)) return false;
  return true;
};

/** One nickname for `name`, different from `avoid`. Returns null if the model doesn't give a usable one. */
export const makeNickname = async (opts: { name: string; facts: string[]; persona: 'aastha' | 'aastik'; avoid?: string[]; ms?: number }): Promise<string | null> => {
  const first = clean(opts.name, 40).split(' ')[0] || 'friend';
  const avoid = (opts.avoid || []).map((a) => clean(a, 24)).filter(Boolean);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await withTimeout(completeChat([
      {
        role: 'system',
        content: `Invent ONE nickname that ${opts.persona === 'aastik' ? 'a loyal, dry-humoured best friend' : 'a warm, playful best friend'} would call someone.
Base it on their name (a playful twist, short form, rhyme, mash-up or a desi-style variation) and/or something they shared.
Rules: 1–3 words, max 18 characters, affectionate and fun, never mean, never romantic or sexual, no numbers.
Not generic (${GENERIC.slice(0, 8).join(', ')}…).${avoid.length ? ` Must be different from: ${avoid.join(', ')}.` : ''}
Return JSON only: {"nickname":"…"}`,
      },
      { role: 'user', content: `Name: ${first}\nThings they shared: ${opts.facts.slice(-6).map((f) => clean(f, 80)).join('; ') || 'nothing yet'}` },
    ], { task: 'brain', temperature: 1.0, maxTokens: 60 } as any), opts.ms ?? 6000);
    const nick = clean(parseJson(raw as any)?.nickname, 24);
    if (nick && isOkNickname(nick) && !avoid.some((a) => a.toLowerCase() === nick.toLowerCase())) return nick;
  }
  return null;
};

export const nicknamePromptLine = (nickname: string | undefined, announced: boolean, persona: 'aastha' | 'aastik') =>
  nickname
    ? `Your nickname for them is "${nickname}"${announced
        ? ''
        : `you just came up with it because you're besties now. Tell them about it once, playfully and in your own words, in this reply`
      }. Use it now and then (not every message), and not when they're upset or talking about something serious.${persona === 'aastik' ? '' : ''}`
    : '';

// ── Follow-up nudge ─────────────────────────────────────────────────────────────────────────────────────
export type NudgeReason = 'reaction' | 'seen';

export const nudgeInstruction = (reason: NudgeReason, reaction?: string | null) =>
  reason === 'reaction' && reaction
    ? `They reacted ${reaction} to your last message, then went quiet. Send ONE short follow-up text (one line, at most ~15 words) that responds to that reaction the way a close friend would: playful if it's a laugh, curious if it's surprise, and softer, checking whether something you said landed wrong, if it's an eye-roll, a blank face or a sad one. Don't repeat or summarise your last message. No greeting.`
    : `They read your last message but haven't replied for a bit. Send ONE short, easy follow-up (one line, at most ~12 words): a lighter way back into the chat or an easy out. Never guilt them, never sound needy, don't repeat your question word for word. No greeting.`;
