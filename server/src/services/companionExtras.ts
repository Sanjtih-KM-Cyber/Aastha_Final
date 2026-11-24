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
// Lines that only a companion/therapist would say, never the user
const COMPANION_VOICE = /\b(i'?m here for you|i'?m all ears|how can i help|let me know|my bad|tell me more|want to talk about it|how (are|do) you feel(ing)?|that sounds (hard|tough|rough)|i understand|i'?m (so )?sorry (you|to hear)|i'?m glad you|you('| a)re not alone|take your time|no pressure|proud of you)\b/i;

export const suggestReplies = async (opts: {
  botName: string; userText: string; reply: string; ms?: number;
  history?: { role: 'user' | 'assistant'; content: string }[];  // recent turns (oldest → newest), before userText
}): Promise<string[]> => {
  const { botName, userText, reply } = opts;
  if (!reply.trim()) return [];
  // ROLE SWAP: the model plays the USER. The companion's texts arrive as the "other person" (role: user) and the
  // user's own texts are the model's (role: assistant), so "what would I send next" comes out in the user's voice.
  const turns = [...(opts.history || []).slice(-6), { role: 'user' as const, content: userText }, { role: 'assistant' as const, content: reply }]
    .map((t) => ({ role: (t.role === 'user' ? 'assistant' : 'user') as 'user' | 'assistant', content: clean(t.content, 500) }))
    .filter((t) => t.content);
  const raw = await withTimeout(completeChat([
    {
      role: 'system',
      content: `You are the person texting ${botName}, a close friend. You see your own past texts (assistant) and ${botName}'s texts (user).
Write 3 different texts YOU might send next, replying to ${botName}'s last message. They become tap-to-send buttons.
- You are the human, not ${botName}: never comfort, never ask how anyone feels, never offer help.
- Reply to what ${botName} actually said: answer the question, pick an option, react to the specific thing.
- Sound like your own earlier texts: same language and script, same casing, slang, emoji habits.
- 1 to 6 words each, all different: one direct answer, one playful or cheeky, one that takes it somewhere else.
Examples:
${botName}: "honestly same. laundry or netflix, which one's guilting you more"  →  {"replies":["netflix obviously","ugh the laundry","neither, I'm napping"]}
${botName}: "WAIT. the one you were stressing about?? that's huge"  →  {"replies":["yesss that one!!","still can't believe it","now I'm scared lol"]}
${botName}: "ugh. what happened"  →  {"replies":["my boss yelled at me","long story","don't wanna talk rn"]}
${botName}: "kya plan hai weekend ka"  →  {"replies":["kuch nahi yaar","goa chalein?","sona hai bas"]}
Return JSON only: {"replies":["…","…","…"]}`,
    },
    ...turns,
    { role: 'user', content: '(write the 3 texts you might send next, JSON only)' },
  ], { task: 'chat', temperature: 0.95, maxTokens: 120 } as any), opts.ms ?? 3500);
  const list: unknown[] = parseJson(raw as any)?.replies || [];
  const bot = botName.toLowerCase();
  const seen = new Set<string>();
  return list
    .map((r) => clean(r, 42).replace(/\s*—\s*/g, ', '))
    .filter((r) => {
      const low = r.toLowerCase();
      if (r.length < 2 || r.split(' ').length > 8 || seen.has(low)) return false;
      seen.add(low);
      if (low.includes(`i'm ${bot}`) || low.includes(`i am ${bot}`) || COMPANION_VOICE.test(low)) return false; // the companion talking
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
