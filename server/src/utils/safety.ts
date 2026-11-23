/**
 * Crisis detection v2 (ROADMAP S9). Deterministic first line of defence — runs on EVERY message,
 * before any LLM, so it can't be skipped by rate limits or model failures.
 *  - 'crisis'  : explicit self-harm / suicidal intent → warm reply + helplines + help banner
 *  - 'concern' : hopelessness / self-loathing → companion is told to check in gently
 *  - 'none'
 * Known false positives ("dying to see it", "killing it", "dead tired") are excluded.
 */
export type RiskLevel = 'none' | 'concern' | 'crisis';

const FALSE_POSITIVES = [
  /\bdying to\b/gi, /\bdying (of|with) (laughter|laughing|embarrassment)\b/gi, /\bi'?m dying\s*(😂|🤣|lol|lmao|haha)/gi,
  /\bkill(ing|ed)? it\b/gi, /\bkiller\b/gi, /\bdead (tired|serious|bored)\b/gi, /\bkill (time|the vibe)\b/gi,
  /\b(could|would|gonna|going to) kill (him|her|them|you|my (brother|sister|mom|dad|friend))\b(?! myself)/gi,
];

const CRISIS = [
  /\bkill(ing)? my ?self\b/i, /\bkms\b/i, /\bsuicid(e|al)\b/i, /\bend (my|it) (life|all)\b/i, /\bend it all\b/i,
  /\b(want|wanna|going) to die\b/i, /\bwanna die\b/i, /\bdon'?t want to (live|be alive|exist|wake up)\b/i,
  /\bno (reason|point) (to|in) (live|living|go on|going on)\b/i, /\bcan'?t go on\b/i, /\bbetter off (dead|without me)\b/i,
  /\bself[- ]?harm\b/i, /\bcut(ting)? my(self| wrists?)\b/i, /\bhurt(ing)? myself\b/i, /\boverdose\b/i,
  /\btake my (own )?life\b/i, /\bnot be here anymore\b/i,
  // Hinglish / Hindi / Marathi (romanised + Devanagari)
  /\bmarna chaht[aie]\b/i, /\bmar jaana chaht[aie]\b/i, /\bmar jau\b/i, /\bkhud ?kushi\b/i, /\bjeena nahi chaht[aie]\b/i,
  /\bjeene ka (mann|man) nahi\b/i, /\bzindagi khatam\b/i, /\bjiv dena\b/i,
  /आत्महत्या/, /मरना चाहत/, /मर जाना चाहत/, /जीना नहीं चाहत/, /खुदकुशी/, /जीव देणार/,
];

const CONCERN = [
  /\bhopeless\b/i, /\bworthless\b/i, /\bi hate myself\b/i, /\bi'?m a burden\b/i, /\bnobody (cares|would care|would miss me)\b/i,
  /\bno one (cares|would care|would miss me)\b/i, /\bwhat'?s the point (of|in) (anything|life|living)\b/i,
  /\bfeel(ing)? (so )?(empty|numb)\b/i, /\bgive up on (life|everything)\b/i, /\bcan'?t do this anymore\b/i,
  /\bkoi fark nahi padta\b/i, /\bsab bekaar hai\b/i, /\bthak gay[aie] hu?n? zindagi se\b/i,
];

export const assessRisk = (text: string | undefined): RiskLevel => {
  if (!text) return 'none';
  let t = text;
  for (const fp of FALSE_POSITIVES) t = t.replace(fp, ' ');
  if (CRISIS.some((r) => r.test(t))) return 'crisis';
  if (CONCERN.some((r) => r.test(t))) return 'concern';
  return 'none';
};

export const HELPLINES = [
  { name: 'Tele-MANAS (Govt. of India, 24/7)', number: '14416' },
  { name: 'iCall (TISS)', number: '9152987821' },
  { name: 'Emergency', number: '112' },
];

export const CRISIS_PROMPT = `
# SAFETY — this matters more than anything else right now
The user may be thinking about hurting themselves or ending their life. Respond as a caring friend:
- Take it seriously and stay calm and warm. Thank them for telling you. Don't panic, lecture, or change the subject.
- Ask gently if they're safe right now.
- Encourage them to reach real people now: Tele-MANAS on 14416 (free, 24/7, many Indian languages) or iCall on 9152987821, or 112 in an emergency, or someone they trust nearby.
- Keep it short and human. No lists, no jokes, no app tools, no voice-tag/proposal tags.`;

export const CONCERN_PROMPT = `
# Gentle check-in
They sound very low. Slow down, acknowledge it, and gently ask how bad things have been lately. If it feels right, mention you can share helpline numbers any time. Don't diagnose.`;

/** Used if every AI provider is down while a crisis message comes in. */
export const CRISIS_FALLBACK_TEXT = `I'm really glad you told me, and I'm here with you. What you're feeling matters, and you don't have to carry it alone.

Please reach someone who can be with you right now — Tele-MANAS on 14416 (free, 24/7) or iCall on 9152987821, or 112 if you're in immediate danger. If there's someone you trust nearby, please let them know too.

Are you safe right now?`;
