/**
 * "The Web", a map of people in the user's life, built ONLY when the user taps "scan" (explicit opt-in).
 *
 * Privacy (ROADMAP S7): these are third parties who never signed up, so name / alias / notes / photo
 * are encrypted at rest and looked up via a blind index (keyed hash). Legacy plaintext rows are
 * upgraded the first time they're read. All AI calls go through services/llm.ts.
 */
import { Person } from '../models/Person';
import { getRecentMessages } from './messageStore';
import { completeChat } from './llm';
import { encrypt, decrypt, blindIndex, isEncrypted, blindIndexCandidates } from '../utils/serverEncryption';

const VERDICTS = ['KEEPER', 'TOXIC', 'SUSPECT', 'NPC'] as const;
type Verdict = (typeof VERDICTS)[number];

/** Who someone is to the user. The AI picks one; anything else becomes 'other' + a short label. */
export const ROLES = [
  'parent', 'sibling', 'family', 'partner', 'ex', 'crush', 'best_friend', 'close_friend', 'friend',
  'roommate', 'colleague', 'manager', 'mentor', 'teacher', 'classmate', 'client', 'neighbour',
  'online_friend', 'acquaintance', 'rival', 'therapist', 'other',
] as const;
/** How the relationship feels to the user right now (not a judgement of the person). */
export const VIBES = ['supportive', 'warm', 'neutral', 'mixed', 'complicated', 'draining', 'distant', 'unsure'] as const;
export type Role = (typeof ROLES)[number];
export type Vibe = (typeof VIBES)[number];

const cleanRole = (r: any): Role => {
  const k = String(r || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const alias: Record<string, Role> = { mom: 'parent', mother: 'parent', dad: 'parent', father: 'parent', brother: 'sibling', sister: 'sibling',
    boyfriend: 'partner', girlfriend: 'partner', husband: 'partner', wife: 'partner', spouse: 'partner', bestie: 'best_friend', bff: 'best_friend',
    boss: 'manager', coworker: 'colleague', co_worker: 'colleague', professor: 'teacher', tutor: 'teacher', counsellor: 'therapist', counselor: 'therapist' };
  return (ROLES as readonly string[]).includes(k) ? (k as Role) : alias[k] || 'other';
};
const cleanVibe = (v: any, score = 0): Vibe => {
  const k = String(v || '').toLowerCase().trim() as Vibe;
  if ((VIBES as readonly string[]).includes(k)) return k;
  // older data / missing: derive from the closeness score
  return score >= 50 ? 'supportive' : score >= 15 ? 'warm' : score <= -40 ? 'draining' : score <= -10 ? 'complicated' : 'neutral';
};
/** Legacy label for older app versions. */
const verdictFromVibe = (v: Vibe): Verdict =>
  v === 'supportive' || v === 'warm' ? 'KEEPER' : v === 'draining' ? 'TOXIC' : v === 'complicated' || v === 'mixed' || v === 'unsure' ? 'SUSPECT' : 'NPC';

const MAX_TRAITS = 5;
const MAX_NAME = 60;
const MAX_TRAIT = 120;
export const MAX_MUGSHOT_CHARS = 2_500_000; // ~1.8 MB image as a data URL

const clampScore = (n: any) => Math.max(-100, Math.min(100, Math.round(Number(n) || 0)));
const cleanVerdict = (v: any): Verdict => (VERDICTS.includes(v) ? v : 'NPC');
const cleanText = (s: any, max: number) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Decrypted shape returned to the app (same fields the client already uses). */
export const toPublicPerson = (doc: any) => ({
  _id: doc._id,
  name: decrypt(doc.name),
  alias: decrypt(doc.alias || ''),
  relationshipScore: doc.relationshipScore,
  verdict: doc.verdict,
  role: doc.role || 'other',
  roleLabel: doc.roleLabel ? decrypt(doc.roleLabel) : '',
  vibe: cleanVibe(doc.vibe, doc.relationshipScore),
  userEdited: !!doc.userEdited,
  rapSheet: (doc.rapSheet || []).map((t: string) => decrypt(t)),
  mugshot: doc.mugshot ? decrypt(doc.mugshot) : '',
  lastUpdated: doc.lastUpdated,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/** Encrypts any plaintext fields of a legacy row and adds its blind index (idempotent). */
const migrateLegacy = async (doc: any) => {
  const needs =
    !doc.nameHash ||
    !isEncrypted(doc.name) ||
    (doc.alias && !isEncrypted(doc.alias)) ||
    (doc.mugshot && !isEncrypted(doc.mugshot)) ||
    (doc.rapSheet || []).some((t: string) => t && !isEncrypted(t));
  if (!needs) return;

  const plainName = decrypt(doc.name);
  const update: any = {
    name: isEncrypted(doc.name) ? doc.name : encrypt(plainName),
    nameHash: blindIndex(plainName),
    alias: doc.alias && !isEncrypted(doc.alias) ? encrypt(doc.alias) : doc.alias,
    rapSheet: (doc.rapSheet || []).map((t: string) => (t && !isEncrypted(t) ? encrypt(t) : t)),
    mugshot: doc.mugshot && !isEncrypted(doc.mugshot) ? encrypt(doc.mugshot) : doc.mugshot,
  };
  try {
    await Person.updateOne({ _id: doc._id }, { $set: update });
  } catch (e: any) {
    // A duplicate blind index means the same person exists twice (old case-sensitive data), keep the first.
    if (e?.code === 11000) await Person.deleteOne({ _id: doc._id });
    else throw e;
  }
};

const findByName = (userId: string, name: string) =>
  Person.findOne({ userId, nameHash: { $in: blindIndexCandidates(name) } });

/** Insert or update one person (encrypted). */
export const upsertPerson = async (
  userId: string,
  p: { name: string; alias?: string; score?: number; verdict?: string; rapSheet?: string[]; role?: string; roleLabel?: string; vibe?: string }
) => {
  const name = cleanText(p.name, MAX_NAME);
  if (!name) return null;
  const traits = (p.rapSheet || []).map((t) => cleanText(t, MAX_TRAIT)).filter(Boolean).slice(0, MAX_TRAITS);
  const score = clampScore(p.score);
  const hasVibe = p.vibe !== undefined || p.verdict === undefined;
  const vibe = hasVibe ? cleanVibe(p.vibe, score) : cleanVibe(undefined, score);
  const role = cleanRole(p.role);
  const existing: any = await Person.findOne({ userId, nameHash: { $in: blindIndexCandidates(name) } }).select('userEdited').lean();
  const set: any = {
    userId,
    name: encrypt(name),
    nameHash: blindIndex(name),
    alias: encrypt(cleanText(p.alias, MAX_NAME)),
    relationshipScore: score,
    rapSheet: traits.map((t) => encrypt(t)),
    lastUpdated: new Date(),
  };
  // Don't overwrite what the user corrected by hand
  if (!existing?.userEdited) {
    set.vibe = vibe;
    set.verdict = p.vibe === undefined && p.verdict ? cleanVerdict(p.verdict) : verdictFromVibe(vibe);
    set.role = role;
    set.roleLabel = role === 'other' && p.roleLabel ? encrypt(cleanText(p.roleLabel, 24)) : '';
  }
  // match under any blind key; $set rewrites the hash with the current key
  return Person.findOneAndUpdate({ userId, nameHash: existing ? { $in: blindIndexCandidates(name) } : blindIndex(name) }, { $set: set }, { upsert: true, new: true });
};

const SCAN_PROMPT = `You map the people in a user's life from their chat with a companion app.
Identify specific PEOPLE the user mentions (friends, family, partners, exes, colleagues). Ignore public figures.
Only include facts the user actually said. Do not guess.

For each person:
- name: as the user refers to them
- alias: a short, kind, descriptive nickname based on how the user talks about them (e.g. "The Planner")
- role: who they are to the user, exactly one of: ${ROLES.join(', ')}. Use "other" only if nothing fits.
- roleLabel: only when role is "other", a 1–3 word label (e.g. "dance teacher", "landlord")
- vibe: how this relationship feels to the user from what they said, exactly one of: ${VIBES.join(', ')}.
  supportive = reliably there for them; warm = positive; neutral; mixed = good and bad; complicated = tension or confusion;
  draining = leaves them hurt/tired; distant = drifting apart; unsure = not enough to tell. Describe the relationship, never insult the person.
- score: relationship closeness from -100 (very negative) to 100 (very positive), 0 = neutral
- rapSheet: up to 3 short facts or patterns the user described

Return JSON only: {"people":[{"name":"","alias":"","role":"friend","roleLabel":"","vibe":"warm","score":0,"rapSheet":[]}]}`;

export const detectiveService = {
  // 1. SCAN (user-triggered): analyse recent chat and update the user's Web
  runRetroactiveScan: async (userId: string) => {
    try {
      const recentMessages: any[] = await getRecentMessages(userId, 20);
      if (!recentMessages || recentMessages.length === 0) return { status: 'no_history' };

      const textLog = recentMessages.map((m: any) => `${m.role}: ${decrypt(m.content)}`).join('\n');
      const raw = await completeChat(
        [
          { role: 'system', content: SCAN_PROMPT },
          { role: 'user', content: `Chat log:\n${textLog}` },
        ],
        { task: 'chat', temperature: 0.1, maxTokens: 900, json: true }
      );

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { people: [] };
      }

      let count = 0;
      for (const p of Array.isArray(parsed.people) ? parsed.people.slice(0, 25) : []) {
        if (await upsertPerson(userId, p)) count++;
      }
      return { status: 'success', count };
    } catch (error: any) {
      console.error('RetroScan Error:', error?.message || error);
      return { status: 'error' };
    }
  },

  // 2. INCREMENTAL UPDATE (for future brain tool use)
  updateDossier: async (userId: string, updates: any) => {
    try {
      const { name, deltaScore, newTrait, verdict } = updates || {};
      const cleanName = cleanText(name, MAX_NAME);
      if (!cleanName) return { status: 'invalid_data' };

      const person: any = await findByName(userId, cleanName);
      if (!person) {
        const created = await upsertPerson(userId, {
          name: cleanName,
          alias: 'New face',
          score: deltaScore || 0,
          verdict,
          rapSheet: newTrait ? [newTrait] : [],
        });
        return { status: 'created', person: created ? toPublicPerson(created) : null };
      }

      if (deltaScore) person.relationshipScore = clampScore(person.relationshipScore + Number(deltaScore));
      if (verdict) person.verdict = cleanVerdict(verdict);
      if (newTrait) {
        const traits = (person.rapSheet || []).map((t: string) => decrypt(t));
        const trait = cleanText(newTrait, MAX_TRAIT);
        if (trait && !traits.includes(trait)) traits.push(trait);
        person.rapSheet = traits.slice(-MAX_TRAITS).map((t: string) => encrypt(t));
      }
      person.lastUpdated = new Date();
      await person.save();
      return { status: 'updated', person: toPublicPerson(person) };
    } catch (error: any) {
      console.error('UpdateDossier Error:', error?.message || error);
      return { status: 'error' };
    }
  },

  // 3. READ: decrypted for the app; legacy plaintext rows are encrypted on the way through
  getWeb: async (userId: string) => {
    const docs = await Person.find({ userId }).lean();
    for (const d of docs) await migrateLegacy(d);
    const fresh = await Person.find({ userId }).sort({ relationshipScore: -1 }).lean();
    return fresh.map(toPublicPerson);
  },

  /** The user corrects who someone is / how it feels. Marks the row so a re-scan keeps their choice. */
  setClassification: async (userId: string, personId: string, input: { role?: string; roleLabel?: string; vibe?: string }) => {
    const set: any = { userEdited: true, lastUpdated: new Date() };
    if (input.role !== undefined) {
      const role = cleanRole(input.role);
      set.role = role;
      set.roleLabel = role === 'other' && input.roleLabel ? encrypt(cleanText(input.roleLabel, 24)) : '';
    }
    if (input.vibe !== undefined) {
      if (!(VIBES as readonly string[]).includes(String(input.vibe))) return null;
      set.vibe = input.vibe;
      set.verdict = verdictFromVibe(input.vibe as Vibe);
    }
    const person = await Person.findOneAndUpdate({ _id: personId, userId }, { $set: set }, { new: true }).lean();
    return person ? toPublicPerson(person) : null;
  },

  setMugshot: async (userId: string, personId: string, image: string) => {
    const person = await Person.findOneAndUpdate(
      { _id: personId, userId },
      { $set: { mugshot: encrypt(image), lastUpdated: new Date() } },
      { new: true }
    ).lean();
    return person ? toPublicPerson(person) : null;
  },
};
