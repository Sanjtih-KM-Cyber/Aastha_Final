/**
 * Sarvam AI "Bulbul" text-to-speech (owner choice, 2026-11-24): Indian voices that sound like a real person, for
 * Indian English, Hinglish and 10 Indian languages. Kokoro (the old engine on the HF Space) read Hinglish with an
 * American engine, which is why voice notes sounded robotic.
 *
 * On only when SARVAM_API_KEY is set (Render env). Any failure → the caller falls back to the HF Space voice.
 * Cloned voices (Clone Mode) always stay on the HF Space (F5): Sarvam can't clone.
 *
 * API: POST https://api.sarvam.ai/text-to-speech, header `api-subscription-key`,
 *      body { text (≤ 2500 chars), language_code, model, speaker, pace, … } → { audios: [base64 wav] }
 * Cost: ~₹3 per 1,000 characters (bulbul:v3, pay as you go). New accounts get ₹100 free credit.
 */
import axios from 'axios';

const URL = 'https://api.sarvam.ai/text-to-speech';
const MAX_CHARS = 2500;

export const sarvamEnabled = () => !!process.env.SARVAM_API_KEY;

const model = () => process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
// Owner picked shreya (Aastha) + rohan (Aastik) by ear, 2026-11-24. Voices are env-overridable so the owner can pick by ear without a code change (speaker names are model-specific)
const speakerFor = (persona: string) =>
  persona === 'aastik' ? (process.env.SARVAM_VOICE_AASTIK || 'rohan') : (process.env.SARVAM_VOICE_AASTHA || 'shreya');

// Script → Sarvam language code. Latin text (English / romanised Hinglish) is read as Indian English.
const SCRIPTS: [RegExp, string][] = [
  [/[ঀ-৿]/g, 'bn-IN'], // Bengali
  [/[਀-੿]/g, 'pa-IN'], // Gurmukhi
  [/[઀-૿]/g, 'gu-IN'], // Gujarati
  [/[଀-୿]/g, 'od-IN'], // Odia
  [/[஀-௿]/g, 'ta-IN'], // Tamil
  [/[ఀ-౿]/g, 'te-IN'], // Telugu
  [/[ಀ-೿]/g, 'kn-IN'], // Kannada
  [/[ഀ-ൿ]/g, 'ml-IN'], // Malayalam
  [/[ऀ-ॿ]/g, 'hi-IN'], // Devanagari (Hindi; Marathi via the language hint)
];

export const languageFor = (text: string, preferredLanguage?: string): string => {
  const letters = (text.match(/[A-Za-zऀ-ൿ]/g) || []).length || 1;
  for (const [re, code] of SCRIPTS) {
    if ((text.match(re) || []).length / letters > 0.3) {
      return code === 'hi-IN' && /marathi/i.test(preferredLanguage || '') ? 'mr-IN' : code;
    }
  }
  return 'en-IN';
};

/** Same speed nudges as the HF Space routing ([STYLE: …] tag). */
export const paceFor = (description?: string) => {
  const d = (description || '').toLowerCase();
  if (/(slow|soft|gentle|calm|whisper|sad|tender|soothing)/.test(d)) return 0.92;
  if (/(fast|excited|energetic|cheerful|upbeat)/.test(d)) return 1.06;
  return 1.0;
};

/** Cut at a sentence end (incl. the Hindi danda) so a long reply never stops mid-word. */
export const trimForTts = (text: string, max = MAX_CHARS) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('।'));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut).trim();
};

export const sarvamSpeak = async (text: string, persona: string, opts: { description?: string; preferredLanguage?: string } = {}): Promise<Buffer | null> => {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return null;
  const clean = trimForTts(text);
  if (!clean) return null;
  try {
    const r = await axios.post(URL, {
      text: clean,
      language_code: languageFor(clean, opts.preferredLanguage),
      model: model(),
      speaker: speakerFor(persona === 'aastik' || persona === 'aarav' ? 'aastik' : 'aastha'),
      pace: paceFor(opts.description),
      speech_sample_rate: 24000,
    }, {
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      timeout: 30_000,
      validateStatus: () => true,
    });
    if (r.status !== 200 || !Array.isArray(r.data?.audios) || !r.data.audios.length) {
      // 402 = credits used up, 429 = rate limit, 400 = bad speaker/model. Never log the text or the key.
      console.warn(`[Sarvam TTS] ${r.status} ${r.data?.error?.code || r.data?.error?.message || ''}`.trim());
      return null;
    }
    const buf = Buffer.concat(r.data.audios.map((a: string) => Buffer.from(String(a), 'base64')));
    return buf.length > 100 ? buf : null;
  } catch (e: any) {
    console.warn('[Sarvam TTS] request failed:', e?.code || e?.message || 'error');
    return null;
  }
};
