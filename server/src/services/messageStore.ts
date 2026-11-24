import mongoose from 'mongoose';
import Chat from '../models/Chat';
import Message, { IMessageDoc } from '../models/Message';

type Role = 'user' | 'assistant';

export interface NewMessage {
  role: Role;
  content: string; // already encrypted
  timestamp?: Date;
  voice_note?: string;
  isClone?: boolean;
  isNudge?: boolean;
  isLetter?: boolean;
  gif?: { url: string; width?: number; height?: number; title?: string; source?: string };
}

const toObjectId = (id: string | mongoose.Types.ObjectId) =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

/**
 * Lazily moves a user's legacy `Chat.messages[]` into the `Message` collection.
 * - Claims the legacy doc atomically (sets `migratedAt`) so concurrent requests can't double-copy.
 * - Leaves the legacy doc's messages untouched as a rollback backup.
 * - On insert failure, releases the claim so it retries next time.
 */
// Users already checked in this process, skips the DB round-trip on every message.
const migratedUsers = new Set<string>();
// Concurrent first requests share ONE migration instead of the loser reading an empty collection.
const inFlight = new Map<string, Promise<void>>();

export const ensureMigrated = async (userId: string | mongoose.Types.ObjectId): Promise<void> => {
  const uid = toObjectId(userId);
  const key = uid.toString();
  if (migratedUsers.has(key)) return;

  let job = inFlight.get(key);
  if (!job) {
    job = (async () => {
      try {
        await migrateLegacyChat(uid);
        migratedUsers.add(key);
      } catch {
        // Don't block chatting; old messages are ordered by timestamp, so a later retry slots them in correctly.
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, job);
  }
  await job;
};

const migrateLegacyChat = async (uid: mongoose.Types.ObjectId): Promise<void> => {
  const claimed = await Chat.findOneAndUpdate(
    { user: uid, migratedAt: { $exists: false } },
    { $set: { migratedAt: new Date() } },
    { new: false }
  ).lean();

  if (!claimed) return; // nothing to migrate, or already migrated/in progress

  const legacy = (claimed as any).messages || [];
  if (legacy.length === 0) return;

  try {
    const docs = legacy.map((m: any) => ({
      user: uid,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || new Date(0),
      voice_note: m.voice_note,
      // keep legacy subdocument ids so client-side message ids stay stable
      ...(m._id ? { _id: m._id } : {}),
    }));
    await Message.insertMany(docs, { ordered: false });
    console.log(`[MessageStore] Migrated ${docs.length} messages for user ${uid}`);
  } catch (err: any) {
    // Duplicate keys mean a previous partial run already copied some, that's fine.
    if (err?.code === 11000 || err?.writeErrors?.every((e: any) => e.code === 11000)) return;
    console.error(`[MessageStore] Migration failed for user ${uid}, will retry:`, err?.message);
    await Chat.updateOne({ _id: (claimed as any)._id }, { $unset: { migratedAt: 1 } });
    throw err;
  }
};

/** Newest `limit` messages (optionally older than `before`), returned oldest → newest. */
export const getRecentMessages = async (
  userId: string | mongoose.Types.ObjectId,
  limit = 20,
  before?: Date
): Promise<IMessageDoc[]> => {
  await ensureMigrated(userId);
  const query: any = { user: toObjectId(userId) };
  if (before && !isNaN(before.getTime())) query.timestamp = { $lt: before };

  const docs = await Message.find(query).sort({ timestamp: -1, _id: -1 }).limit(limit).lean<IMessageDoc[]>();
  return docs.reverse();
};

export const appendMessages = async (userId: string | mongoose.Types.ObjectId, msgs: NewMessage[]) => {
  if (msgs.length === 0) return [];
  const uid = toObjectId(userId);
  const now = Date.now();
  // Guarantee ordering within one call (user message before assistant reply)
  return Message.insertMany(
    msgs.map((m, i) => ({ user: uid, ...m, timestamp: m.timestamp || new Date(now + i) }))
  );
};

export const countMessages = (userId: string | mongoose.Types.ObjectId) =>
  Message.countDocuments({ user: toObjectId(userId) });

export const deleteAllMessages = async (userId: string | mongoose.Types.ObjectId) => {
  const uid = toObjectId(userId);
  migratedUsers.delete(uid.toString());
  await Promise.all([Message.deleteMany({ user: uid }), Chat.deleteMany({ user: uid })]);
};

/** Streams every message for a user (oldest first) without loading them all into memory. */
export const iterateAllMessages = async (userId: string | mongoose.Types.ObjectId) => {
  await ensureMigrated(userId);
  return Message.find({ user: toObjectId(userId) }).sort({ timestamp: 1, _id: 1 }).lean().cursor();
};
