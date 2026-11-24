/**
 * Memory v2 (ROADMAP A4).
 * - Facts are only things the USER said about themselves (never inferred, never from the assistant).
 * - The summary is updated conservatively: keep what's there unless the user corrected it.
 * - Facts are actually persisted now (before, extracted facts were thrown away), encrypted at rest,
 *   de-duplicated and capped.
 * - No gender/identity inference (S14).
 */
import User from '../models/User';
import { completeChat } from './llm';
import { encrypt, decrypt } from '../utils/serverEncryption';
import { saveExtractedFollowUps } from './reachOut';
import { withoutForgotten } from './memoryEditor';
import { dayKeyIn, weekdayIn, tzOrDefault } from '../utils/timeZone';

const MAX_FACTS = 40;
const MAX_FACT_LEN = 160;

export interface MemoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface MemoryUpdate {
  summary?: string;
  new_facts?: string[];
  outdated_facts?: string[];
  follow_ups?: { event?: string; date?: string }[];
}

const PROMPT = `You maintain a companion app's memory about ONE user. Return JSON only:
{"summary": string, "new_facts": string[], "outdated_facts": string[], "follow_ups": [{"event": string, "date": "YYYY-MM-DD"}]}

Rules:
- new_facts: short third-person facts the USER explicitly stated about themselves or their life in the NEW messages
  (e.g. "Has exams in March", "Sister is called Riya", "Loves lo-fi music"). Never infer, guess or assume.
  Never take facts from the assistant's messages. Skip passing moods ("is tired today"). Skip anything already in Known facts.
- outdated_facts: exact strings from Known facts that the user has now contradicted or said are no longer true.
- summary: update the previous summary with anything important from the new messages (ongoing situations, plans,
  people, how they've been feeling lately). Keep existing details unless the user corrected them. Max 120 words.
  Do not add anything that isn't in the messages.
- follow_ups: upcoming, dated things the USER said they have coming up in the NEW messages (exam, interview, appointment,
  trip, a friend's wedding, a difficult conversation), only if the user gave or clearly implied a day ("on Friday",
  "tomorrow", "next Monday", "on the 12th"). Resolve the date using Today below. "event" is a short noun phrase that reads
  naturally after "how did … go?" (e.g. "your exam", "the interview at Infosys"). No dates in the past, nothing vague
  ("someday", "soon"), nothing about the assistant, nothing related to self-harm. Usually this is an empty list.`;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();

/** Pure merge step (exported for tests). */
export const mergeFacts = (existing: string[], update: MemoryUpdate): string[] => {
  const outdated = new Set((update.outdated_facts || []).map(norm));
  const kept = existing.filter((f) => !outdated.has(norm(f)));
  const seen = new Set(kept.map(norm));
  for (const raw of update.new_facts || []) {
    const f = String(raw || '').trim().slice(0, MAX_FACT_LEN);
    if (!f || seen.has(norm(f))) continue;
    seen.add(norm(f));
    kept.push(f);
  }
  return kept.slice(-MAX_FACTS); // keep the most recent
};

export const updateMemory = async (userId: string, recentTurns: MemoryTurn[]): Promise<void> => {
  const user = await User.findById(userId).select('facts memorySummary timeZone memoryEditedAt +forgottenFacts');
  if (!user) return;

  const knownFacts = (user.facts || []).map((f) => decrypt(f)).filter(Boolean);
  const previousSummary = decrypt(user.memorySummary || '');
  const transcript = recentTurns
    .filter((t) => t.content && t.content.trim())
    .map((t) => `${t.role === 'user' ? 'USER' : 'ASSISTANT'}: ${t.content}`)
    .join('\n');
  if (!transcript) return;

  const raw = await completeChat(
    [
      { role: 'system', content: PROMPT },
      {
        role: 'user',
        content: `Today: ${dayKeyIn(new Date(), tzOrDefault((user as any).timeZone))} (${weekdayIn(new Date(), tzOrDefault((user as any).timeZone))}, the user's local date)\nPrevious summary: ${previousSummary || '(none)'}\nKnown facts: ${JSON.stringify(knownFacts)}\n\nNEW messages:\n${transcript}`,
      },
    ],
    { task: 'chat', temperature: 0.2, maxTokens: 600, json: true }
  );

  let update: MemoryUpdate;
  try {
    update = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return;
    update = JSON.parse(m[0]);
  }

  // Facts the user deleted in "What Aastha remembers" are never re-learned
  const facts = withoutForgotten(mergeFacts(knownFacts, update), (user as any).forgottenFacts || []);
  const summary = typeof update.summary === 'string' && update.summary.trim() ? update.summary.trim() : previousSummary;

  // Only if the user didn't edit their memory while the model was thinking (their edit wins; next update catches up)
  const editedAt = (user as any).memoryEditedAt || null;
  const r = await User.updateOne(
    { _id: userId, memoryEditedAt: editedAt ? editedAt : { $in: [null] } },
    { $set: { facts: facts.map((f) => encrypt(f)), memorySummary: summary ? encrypt(summary) : user.memorySummary } }
  );
  if (!r.matchedCount) console.log('[Memory] user edited memory meanwhile, facts/summary update skipped this round');
  // 7.4: dated things they mentioned → gentle next-day check-in (services/reachOut.ts)
  if (Array.isArray(update.follow_ups) && update.follow_ups.length) {
    await saveExtractedFollowUps(userId, update.follow_ups).catch((e) => console.error('[Memory] follow-ups:', e?.message || e));
  }
};
