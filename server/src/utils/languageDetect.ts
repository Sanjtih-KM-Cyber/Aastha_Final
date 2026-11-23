/**
 * Lightweight, deterministic language + script detection for style mirroring (no API calls).
 * Covers every major Indian script, Arabic/Urdu script, and romanised Indian languages written in
 * English letters (Hinglish, Tanglish, Banglish, Manglish, Telugu, Kannada, Marathi, Gujarati, Punjabi).
 * Anything else falls back to "latin" (English / other Latin-script languages — the AI handles those).
 */

export type LangCode =
  | 'latin'
  | 'hindi' | 'bengali' | 'tamil' | 'telugu' | 'kannada' | 'malayalam' | 'gujarati' | 'punjabi' | 'odia' | 'urdu'
  | 'hinglish' | 'tanglish' | 'banglish' | 'manglish' | 'telugu_roman' | 'kannada_roman' | 'marathi_roman' | 'gujarati_roman' | 'punjabi_roman';

const SCRIPTS: [LangCode, RegExp][] = [
  ['hindi', /[ऀ-ॿ]/g],      // Devanagari (Hindi, Marathi, Nepali…)
  ['bengali', /[ঀ-৿]/g],    // Bengali / Assamese
  ['punjabi', /[਀-੿]/g],    // Gurmukhi
  ['gujarati', /[઀-૿]/g],
  ['odia', /[଀-୿]/g],
  ['tamil', /[஀-௿]/g],
  ['telugu', /[ఀ-౿]/g],
  ['kannada', /[ಀ-೿]/g],
  ['malayalam', /[ഀ-ൿ]/g],
  ['urdu', /[؀-ۿ]/g],       // Arabic script (Urdu, Arabic, Persian)
];

// Common, fairly distinctive words per romanised language (no English look-alikes).
const ROMAN: [LangCode, string][] = [
  ['hinglish', 'yaar yar hai hain kya kyu kyun nahi nahin acha accha achha bhai matlab kuch bas toh kar karna mera meri tera teri mujhe tujhe tum aap bohot bahut thoda sab kaise kaisa kab kahan pata bilkul ekdum mast pagal raha rahi gaya gayi hoon hu tha thi bhi lekin kyunki wala wali'],
  ['tanglish', 'enna da di illa illai seri romba nalla machan machi sapdiya vaa po theriyum irukku iruku panra pannu dei konjam epdi enga yen paathu sollu solren vandhu ponga aama appo inniku'],
  ['banglish', 'ami tumi kemon acho bhalo korcho kotha khub achhi achi hobe keno ekhon amar tomar ki korbo jabo bujhli bujhechi accha thik chilo dekho shono'],
  ['manglish', 'enthu enthanu aanu alle sheri chetta chechi entha evide ningal njan pinne kollam machane ninte ente onnum venda vendaa kazhicho poyi vannu ithu athu'],
  ['telugu_roman', 'emi ela unnav unnavu chala baga ledu enti ra cheppu nenu nuvvu avunu kadha ippudu ekkada enduku vachanu vellu chesthunna cheyyi'],
  ['kannada_roman', 'yenu hegidiya hegiddira guru maga swalpa beku gottilla namma neenu naanu houdu sakkath yaake elli banni hogi maadu illi alli'],
  ['marathi_roman', 'kay kasa kashi ahe ahes nahiye mala tula kaay zala bara khup mhanje kuthe kevha aaj udya kalji karu nako ghe ho re'],
  ['gujarati_roman', 'kem cho maja shu nathi tame tamne hu che saru kevu majama bhale aavjo karo chhe nathi kyare kya'],
  ['punjabi_roman', 'ki haal tusi assi kida paaji veere changa sanu tenu oye kithe kiddan hega gal chal kardi karda'],
];
const ROMAN_SETS = ROMAN.map(([code, words]) => [code, new Set(words.split(/\s+/))] as const);

/** Dominant language/script of ONE message. */
export const detectLanguage = (text: string): LangCode => {
  const t = text || '';
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (!letters) return 'latin';
  let bestScript: LangCode | null = null;
  let bestCount = 0;
  for (const [code, re] of SCRIPTS) {
    const c = (t.match(re) || []).length;
    if (c > bestCount) { bestCount = c; bestScript = code; }
  }
  if (bestScript && bestCount / letters > 0.3) return bestScript;

  const words = t.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (!words.length) return 'latin';
  let best: LangCode = 'latin';
  let bestHits = 0;
  for (const [code, set] of ROMAN_SETS) {
    const hits = words.filter((w) => set.has(w)).length;
    if (hits > bestHits) { bestHits = hits; best = code; }
  }
  // need a meaningful share of distinctive words (short messages: 1 hit is enough)
  return bestHits >= Math.max(1, Math.ceil(words.length * 0.15)) ? best : 'latin';
};

export const LANGUAGE_LABELS: Record<LangCode, string> = {
  latin: 'English (or another Latin-script language)',
  hindi: 'Devanagari script (Hindi/Marathi)', bengali: 'Bengali script', tamil: 'Tamil script', telugu: 'Telugu script',
  kannada: 'Kannada script', malayalam: 'Malayalam script', gujarati: 'Gujarati script', punjabi: 'Gurmukhi (Punjabi) script',
  odia: 'Odia script', urdu: 'Urdu/Arabic script',
  hinglish: 'Hinglish (Hindi in English letters)', tanglish: 'Tanglish (Tamil in English letters)',
  banglish: 'Banglish (Bengali in English letters)', manglish: 'Manglish (Malayalam in English letters)',
  telugu_roman: 'Telugu in English letters', kannada_roman: 'Kannada in English letters',
  marathi_roman: 'Marathi in English letters', gujarati_roman: 'Gujarati in English letters', punjabi_roman: 'Punjabi in English letters',
};
