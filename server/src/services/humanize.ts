/**
 * Humanizer — a safety net under the prompt. Even good prompts let models slip into assistant-speak, so the
 * streamed reply is cleaned sentence by sentence BEFORE the user sees it (and the same text is what's saved):
 *  - whole filler sentences are dropped ("No pressure 😊", "I'm all ears!", "Let me know!", "I'm here for you.")
 *  - stock openers are trimmed from the very start ("Haha, okay, noted! …", "Absolutely! …", "Great question! …")
 *  - therapy-speak openers are trimmed ("It's totally okay to …" → kept only if it's the whole message)
 *  - at most ONE emoji per reply (people don't stack 3 emojis at the end of every text)
 * App tags (<proposal …/>, <color>…</color>) pass through untouched. If cleaning would leave nothing, the original
 * sentence is kept — we never send an empty reply.
 */

// Whole sentences that add nothing — dropped wherever they appear
const FILLER_SENTENCES: RegExp[] = [
  /^(no pressure|no rush|zero pressure)( at all)?( though)?[.!]*$/i,
  /^(i'?m|i am) (all ears|here for you|always here( for you)?|here to listen|here if you need (me|anything))[.!]*$/i,
  /^(just )?(let me know|lmk)( (if|what|when|how)[^.!?]*)?[.!]*$/i,
  /^(feel free to [^.!?]*)[.!]*$/i,
  /^(take your time|you('| a)re not alone( in this)?|you('| a)?ve got this|you('| a)re doing great)[.!]*$/i,
  /^(what (do you think|comes to mind|sounds good)|how does that sound|sound good)\??$/i,
  /^(just pure fun|no rules,? just (pure )?fun|totally up to you|your call)[.!]*$/i,
  /^(remember,? )?(it'?s|that'?s) (completely|totally|perfectly|absolutely) (okay|ok|normal|valid)[.!]*$/i,
];

// A FIRST sentence that is nothing but a stock opener ("Haha, okay, noted!", "Absolutely!", "Great question!") is dropped
const OPENER_SENTENCES: RegExp[] = [
  /^((haha|hehe|aww+|ooh+)[,!. ]+\s*)?(okay|ok|alright)?,?\s*(noted|got it|gotcha)?[.!]*$/i,
  /^(absolutely|of course|certainly|definitely|great question|good question|love that|i love that|i (totally |completely )?(understand|get it|hear you))[.!]*$/i,
];

// Openers trimmed from the FIRST sentence when more text follows in it
const OPENERS: RegExp[] = [
  /^(haha|hehe|aww+|ooh+)[,!. ]+\s*(okay|ok|alright),?\s*(noted)?[,!.—-]+\s*/i,
  /^(okay|ok|alright),?\s*noted[,!.—-]+\s*/i,
  /^(absolutely|of course|certainly|definitely|great question|good question|i (totally |completely )?(understand|get it|hear you))[,!.—-]+\s*/i,
  /^(it'?s|that'?s) (totally|completely|perfectly) (okay|ok|fine|normal|valid) (to|that)\s+/i,
];

const EMOJI = /\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic})*[\ufe0f\u{1F3FB}-\u{1F3FF}]*/gu;

const stripTrailing = (s: string) => s.replace(/\s+$/, '');

/** Cleans one complete sentence. `isFirst` = first sentence of the reply. Returns '' to drop it. */
export const cleanSentence = (raw: string, isFirst: boolean): string => {
  const lead = raw.match(/^\s*/)?.[0] || '';
  let s = raw.trim();
  if (!s) return raw;
  const bare = s.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
  if (bare && FILLER_SENTENCES.some((r) => r.test(bare))) return '';
  if (isFirst && bare && /[a-z]/i.test(bare) && OPENER_SENTENCES.some((r) => r.test(bare))) return '';
  if (isFirst) {
    for (const r of OPENERS) {
      const m = s.match(r);
      if (m && s.length - m[0].length >= 6) {
        s = s.slice(m[0].length);
        // "It's totally okay to not know" → "not know" reads wrong; only trim the pure exclamation openers
        if (/^(it'?s|that'?s)/i.test(m[0])) { s = raw.trim(); break; }
        s = s.charAt(0).toUpperCase() === s.charAt(0) ? s : s.charAt(0).toUpperCase() + s.slice(1);
        break;
      }
    }
  }
  return lead + noDashes(s);
};

/** Em dashes (and spaced en dashes) read as AI-written — use a comma instead. */
export const noDashes = (s: string) =>
  s.replace(/\s*—\s*/g, ', ').replace(/\s+–\s+/g, ', ').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*([.!?])/g, '$1');

/**
 * Streaming humanizer. push() returns text that is safe to show now; flush() returns the rest.
 * Sentences are emitted at a boundary (. ! ? … or newline). Tags are passed through as-is.
 */
export const createHumanizer = () => {
  let buf = '';
  let emitted = 0;      // sentences emitted (for "first sentence" logic)
  let emojiSeen = 0;
  let any = '';         // everything emitted, to know if we dropped it all
  let lastDropped = false;

  const capEmoji = (s: string) => s.replace(EMOJI, (e) => (++emojiSeen <= 1 ? e : '')).replace(/[ \t]{2,}/g, ' ');

  const emitSentence = (sentence: string): string => {
    const isEmojiOnly = !/[\p{L}\p{N}]/u.test(sentence);
    if (isEmojiOnly && lastDropped) return '';           // "No pressure. 😊" → the 😊 goes with it
    const cleaned = cleanSentence(sentence, emitted === 0 || (emitted > 0 && !any.trim()));
    emitted++;
    lastDropped = !cleaned.trim();
    if (!cleaned.trim()) return '';
    const out = capEmoji(cleaned);
    any += out;
    return out;
  };

  const drain = (final: boolean): string => {
    let out = '';
    for (;;) {
      if (!buf) break;
      // tags: emit whole, untouched
      const lt = buf.indexOf('<');
      if (lt === 0) {
        const gt = buf.indexOf('>');
        if (gt === -1) { if (final) { out += buf; buf = ''; } break; }
        out += buf.slice(0, gt + 1); buf = buf.slice(gt + 1);
        continue;
      }
      const searchIn = lt > 0 ? buf.slice(0, lt) : buf;
      const m = searchIn.match(/^[\s\S]*?([.!?…]+["')\]]*[\s ]+|\n+)/);
      if (m) {
        const sentence = m[0];
        buf = buf.slice(sentence.length);
        const trailingWs = sentence.match(/[\s ]*$/)?.[0] || '';
        const kept = emitSentence(stripTrailing(sentence));
        out += kept ? kept + trailingWs : (sentence.includes('\n') ? '\n' : '');
        continue;
      }
      if (lt > 0) {                         // text right before a tag counts as a finished sentence
        const sentence = buf.slice(0, lt);
        buf = buf.slice(lt);
        out += emitSentence(sentence);
        continue;
      }
      if (final) { const s = buf; buf = ''; out += emitSentence(s); }
      break;
    }
    return out;
  };

  return {
    push: (chunk: string) => { buf += chunk; return drain(false); },
    flush: () => {
      const out = drain(true);
      return out;
    },
    /** True when every sentence was filler (caller then keeps the original reply). */
    get droppedEverything() { return !any.trim(); },
  };
};

/** Non-streaming convenience (tests, nudges, saved text). Falls back to the original if nothing survives. */
export const humanize = (text: string): string => {
  const h = createHumanizer();
  const out = (h.push(text) + h.flush()).replace(/\n{3,}/g, '\n\n').trim();
  return out || text.trim();
};
