/**
 * Reactions on Aastha's messages (ROADMAP 7.4).
 * The user can react to a reply with any emoji (quick bar ❤️ 😂 😮 😢 🙏 👍 + full picker). We keep it on the message and feed the most recent ones back
 * lightly — one prompt line — as a "what landed" signal. Never mentioned to the user unless they bring it up.
 */
import mongoose from 'mongoose';
import Message from '../models/Message';
import { decrypt } from '../utils/serverEncryption';

/** Quick-bar emojis (the app also offers a full picker — any single emoji is accepted). */
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'] as const;
export type Reaction = string;

const MEANING: Record<string, string> = {
  '❤️': 'loved', '😍': 'loved', '🥰': 'loved', '😂': 'laughed at', '🤣': 'laughed at', '👍': 'liked', '🙏': 'appreciated',
  '😮': 'were surprised by', '😢': 'were moved by', '🥹': 'were moved by', '🔥': 'loved', '💯': 'strongly agreed with',
};
const meaningOf = (r: string) => MEANING[r] || `reacted ${r} to`;

// One emoji (incl. skin tones, ZWJ sequences like 👩‍💻, flags, keycaps). No text, no markup.
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\u200d\ufe0f\u20e3#*0-9])+$/u;
const HAS_PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const WINDOW_DAYS = 30;
const MAX_ITEMS = 3;
const SNIPPET = 70;

export const isAllowedReaction = (r: unknown): r is Reaction => {
  if (typeof r !== 'string' || !r || r.length > 16) return false;
  if (!EMOJI_ONLY.test(r) || !HAS_PICTO.test(r)) return false;
  // a single grapheme only (one emoji, not "😂😂😂")
  const Seg = (Intl as any).Segmenter;
  return Seg ? [...new Seg('en', { granularity: 'grapheme' }).segment(r)].length === 1 : true;
};

/** Set (or clear with null) the user's reaction on one of THEIR assistant messages. Returns false if not found. */
export const setReaction = async (userId: string | mongoose.Types.ObjectId, messageId: string, reaction: Reaction | null): Promise<boolean> => {
  if (!mongoose.isValidObjectId(messageId)) return false;
  const update = reaction
    ? { $set: { userReaction: reaction, reactedAt: new Date() } }
    : { $unset: { userReaction: 1, reactedAt: 1 } };
  const r = await Message.updateOne({ _id: messageId, user: userId, role: 'assistant' }, update);
  return r.matchedCount === 1;
};

const snippet = (text: string) => {
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\[[A-Z]+:[^\]]*\]/g, ' ').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > SNIPPET ? `${t.slice(0, SNIPPET - 1).trimEnd()}…` : t;
};

/** Pure formatter (exported for tests). */
export const formatReactionLine = (items: { reaction: string; text: string }[]): string => {
  const usable = items.filter((i) => isAllowedReaction(i.reaction) && i.text.trim()).slice(0, MAX_ITEMS);
  if (!usable.length) return '';
  const parts = usable.map((i) => `they ${meaningOf(i.reaction)} "${snippet(i.text)}"`);
  return `What has landed with them lately (their reactions to your replies): ${parts.join('; ')}. Lean a little more into what worked — don't mention the reactions unless they do.`;
};

export const describeRecentReactions = async (userId: string | mongoose.Types.ObjectId): Promise<string> => {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const docs = await Message.find({ user: userId, role: 'assistant', reactedAt: { $gte: since } })
    .sort({ reactedAt: -1 })
    .limit(MAX_ITEMS)
    .select('content userReaction')
    .lean();
  return formatReactionLine(docs.map((d: any) => ({ reaction: d.userReaction, text: decrypt(d.content || '') })));
};
