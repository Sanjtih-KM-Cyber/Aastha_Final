/**
 * Relationship engine (ROADMAP A6):
 *  1. Style mirroring, a cheap, deterministic fingerprint of how the user texts, smoothed over time.
 *  2. Bond levels, closeness grows with consistent, genuine conversation and fades slowly when away.
 * Pure functions (no DB/LLM) so they're testable; the controller persists the results on the User.
 */
import { dayKeyIn, tzOrDefault } from '../utils/timeZone';
import { detectLanguage, LANGUAGE_LABELS, LangCode } from '../utils/languageDetect';

// ---------------------------------------------------------------------------
// 1. STYLE MIRRORING
// ---------------------------------------------------------------------------
export interface StyleProfile {
  avgWords: number;   // words per message
  emojiRate: number;  // emojis per message
  lowercase: number;  // 0..1 share of messages written without capitals
  hinglish: number;   // 0..1 share of Hinglish/romanised-Indic words
  swears: number;     // 0..1 share of messages containing a swear
  abbrev: number;     // 0..1 share of messages with texting abbreviations (u, idk, lol…)
  exclaim: number;    // 0..1 share of messages with "!"
  lang?: string;      // dominant language/script they write in (utils/languageDetect)
  langShare?: number; // 0..1 how consistently they use it
  samples: number;
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const HINGLISH = new Set(
  // NOTE: no English look-alikes ("to", "main", "na", "par"), they'd mislabel English speakers.
  ('yaar yar hai hain kya kyu kyun nahi nahin nai acha accha achha bhai matlab haan kuch bas toh kr kar karna karo kiya mera meri ' +
   'tera teri mujhe tujhe tum aap bohot bahut sach chal chalo arre arey abhi kal aaj thoda thodi sab koi kaise kaisa kaisi kab kahan ' +
   'jaldi pata bilkul ekdum bindaas mast bakwas pagal dost ghar khana neend padhai pareshan mummy papa didi bhaiya ji ' +
   'ho hoon hu raha rahi rahe gaya gayi gaye tha thi the hoga hogi mein mai bhi aur lekin kyunki wala wali kaam thak soja ' +
   'samajh dekh sun bol bolo pyaar dil yaad ruk ruko').split(' ')
);
const SWEARS = /\b(fuck\w*|shit\w*|wtf|damn|bitch\w*|asshole|bc|mc|bkl|chutiya\w*|saala|saali)\b/i;
const ABBREV = /\b(u|ur|r|idk|lol|lmao|btw|tbh|ngl|omg|pls|plz|thx|ty|k|kk|hmm+|gn|gm|brb|rn|fr)\b/i;

export const fingerprint = (text: string) => {
  const t = (text || '').trim();
  const words = t.split(/\s+/).filter(Boolean);
  const latinWords = words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);
  const hinglishHits = latinWords.filter((w) => HINGLISH.has(w)).length;
  const hasLetters = /[A-Za-z]/.test(t);
  return {
    words: words.length,
    emojis: (t.match(EMOJI) || []).length,
    lowercase: hasLetters && t === t.toLowerCase() ? 1 : 0,
    hinglish: latinWords.length ? Math.min(1, hinglishHits / Math.max(3, latinWords.length) * 2) : 0,
    swears: SWEARS.test(t) ? 1 : 0,
    abbrev: ABBREV.test(t) ? 1 : 0,
    exclaim: t.includes('!') ? 1 : 0,
    lang: detectLanguage(t) as LangCode,
  };
};

const ALPHA = 0.25; // weight of the newest message in the running average

export const updateStyle = (prev: Partial<StyleProfile> | undefined, text: string): StyleProfile => {
  const f = fingerprint(text);
  const p = prev && prev.samples ? (prev as StyleProfile) : undefined;
  if (!p) {
    return { avgWords: f.words, emojiRate: f.emojis, lowercase: f.lowercase, hinglish: f.hinglish,
      swears: f.swears, abbrev: f.abbrev, exclaim: f.exclaim, lang: f.lang, langShare: 1, samples: 1 };
  }
  // Warm-up: plain average for the first few samples, then exponential smoothing
  const a = p.samples < 4 ? 1 / (p.samples + 1) : ALPHA;
  const mix = (old: number, val: number) => +(old * (1 - a) + val * a).toFixed(3);
  // Language: keep the current one while they mostly use it; switch once a new one takes over.
  let lang = p.lang || f.lang;
  let langShare = p.langShare ?? 1;
  if (f.lang === lang) langShare = mix(langShare, 1);
  else {
    langShare = mix(langShare, 0);
    if (langShare < 0.5) { lang = f.lang; langShare = +(1 - langShare).toFixed(3); }
  }
  return {
    avgWords: mix(p.avgWords, f.words),
    emojiRate: mix(p.emojiRate, f.emojis),
    lowercase: mix(p.lowercase, f.lowercase),
    hinglish: mix(p.hinglish, f.hinglish),
    swears: mix(p.swears, f.swears),
    abbrev: mix(p.abbrev, f.abbrev),
    exclaim: mix(p.exclaim, f.exclaim),
    lang,
    langShare,
    samples: Math.min(p.samples + 1, 1000),
  };
};

/** One short instruction describing how to mirror the user. Empty until we've seen enough messages. */
export const describeStyle = (s?: Partial<StyleProfile>): string => {
  if (!s || !s.samples || s.samples < 3) return '';
  const notes: string[] = [];
  const w = s.avgWords || 0;
  if (w <= 6) notes.push('they send very short messages, keep yours to 1–2 short lines');
  else if (w <= 15) notes.push('they write short messages, keep yours to 2–3 lines');
  else if (w >= 40) notes.push('they write long, detailed messages, you can reply in fuller paragraphs');
  if ((s.lowercase || 0) > 0.7) notes.push('they type in all lowercase, lowercase is fine for you too');
  if ((s.emojiRate || 0) >= 1) notes.push('they use emojis a lot, use them freely');
  else if ((s.emojiRate || 0) < 0.15) notes.push('they rarely use emojis, use at most one, often none');
  const lang = s.lang as LangCode | undefined;
  if (lang && lang !== 'latin' && LANGUAGE_LABELS[lang] && (s.langShare ?? 0) >= 0.5) {
    notes.push(`they write in ${LANGUAGE_LABELS[lang]}, reply in the same language and script, the way a friend from there would`);
  } else if ((s.hinglish || 0) > 0.3) notes.push('they mix Hindi and English, reply in natural Hinglish');
  if ((s.abbrev || 0) > 0.4) notes.push('they use texting shorthand (idk, lol, u), casual shorthand is fine');
  if ((s.swears || 0) > 0.3) notes.push('they swear casually, light swearing is okay when it fits');
  if ((s.exclaim || 0) > 0.5) notes.push('they’re expressive with "!", match the energy');
  return notes.length ? `Their texting style: ${notes.join('; ')}.` : '';
};

// ---------------------------------------------------------------------------
// 2. BOND LEVELS
// ---------------------------------------------------------------------------
export interface BondState {
  points: number;
  level: number;          // 0..4 (earned)
  lastDayKey?: string;    // user's local day of the last counted message
  dayCount?: number;      // messages counted today (anti-farming cap)
  lastActiveAt?: Date;
  override?: number | null; // user-chosen closeness (null = let it grow)
}

export const BOND_LEVELS = [
  { name: 'New friend', min: 0 },
  { name: 'Getting to know you', min: 25 },
  { name: 'Friend', min: 100 },
  { name: 'Close friend', min: 300 },
  { name: 'Bestie', min: 700 },
];

const DAILY_MESSAGE_CAP = 30;    // only the first 30 messages a day earn points
const NEW_DAY_BONUS = 4;         // showing up on a new day matters more than spamming
const DEEP_SHARE_BONUS = 2;      // longer, personal messages
const DECAY_GRACE_DAYS = 14;
const DECAY_PER_WEEK = 0.05;

export const levelFor = (points: number) => {
  let lvl = 0;
  BOND_LEVELS.forEach((l, i) => { if (points >= l.min) lvl = i; });
  return lvl;
};

/** Applies inactivity decay + this message's points. Returns new state and whether the earned level went up. */
export const updateBond = (prev: Partial<BondState> | undefined, text: string, now: Date = new Date(), timeZone?: string) => {
  const state: BondState = {
    points: prev?.points || 0,
    level: prev?.level || 0,
    lastDayKey: prev?.lastDayKey,
    dayCount: prev?.dayCount || 0,
    lastActiveAt: prev?.lastActiveAt,
    override: prev?.override ?? null,
  };
  const before = levelFor(state.points);

  // Slow fade after two quiet weeks (never below the start of the current level - 1)
  if (state.lastActiveAt) {
    const idleDays = (now.getTime() - new Date(state.lastActiveAt).getTime()) / 86_400_000;
    if (idleDays > DECAY_GRACE_DAYS) {
      const weeks = (idleDays - DECAY_GRACE_DAYS) / 7;
      const floor = BOND_LEVELS[Math.max(0, before - 1)].min;
      state.points = Math.max(floor, Math.round(state.points * Math.pow(1 - DECAY_PER_WEEK, weeks)));
    }
  }

  const today = dayKeyIn(now, tzOrDefault(timeZone)); // the user's local day
  if (state.lastDayKey !== today) {
    state.points += NEW_DAY_BONUS;
    state.dayCount = 0;
    state.lastDayKey = today;
  }
  if ((state.dayCount || 0) < DAILY_MESSAGE_CAP) {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    state.points += 1 + (words >= 25 ? DEEP_SHARE_BONUS : 0);
    state.dayCount = (state.dayCount || 0) + 1;
  }
  state.lastActiveAt = now;
  state.level = levelFor(state.points);

  return { state, leveledUp: state.level > before };
};

/** The closeness actually used in the prompt: the user's override wins. */
export const effectiveLevel = (b?: Partial<BondState>) =>
  b && typeof b.override === 'number' ? Math.max(0, Math.min(4, b.override)) : levelFor(b?.points || 0);

const TONE_CARDS = [
  // 0 New friend
  'You only just met. Be warm, kind and a little curious, but polite, no nicknames, no teasing, light on emojis. Let them set the pace; don’t pry.',
  // 1 Getting to know you
  'You’ve chatted a bit. Be relaxed and friendly, remember what they’ve shared and bring it up naturally. Gentle humour is fine; still no pet names.',
  // 2 Friend
  'You’re friends now. Be casual and genuine: light teasing, inside references to things they told you, honest opinions when asked.',
  // 3 Close friend
  'You’re close. Be openly affectionate in your persona’s way, check in on things they’ve been going through, tease more freely, and be honest even when it’s not what they want to hear.',
  // 4 Bestie
  'You’re their bestie. Full comfort: playful roasts, nicknames that fit them, "I missed you" when they come back, fierce loyalty, and real honesty when they’re about to do something unwise.',
];

export const bondPromptLine = (b: Partial<BondState> | undefined, leveledUp: boolean) => {
  const lvl = effectiveLevel(b);
  const name = BOND_LEVELS[lvl].name;
  const levelUpNote = leveledUp && (b?.override === null || b?.override === undefined)
    ? ` You’ve just become closer (${name}), you may acknowledge it once, lightly and in your own words, if it fits the moment. Don’t make a big deal of it.`
    : '';
  return `Closeness: ${name}. ${TONE_CARDS[lvl]}${levelUpNote}`;
};
