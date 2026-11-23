/**
 * One-shot migration: copy every legacy `Chat.messages[]` into the `Message` collection.
 * Optional, the API also migrates each user lazily on their first chat/history request.
 * Safe to re-run (already-migrated chats are skipped; legacy docs are left intact as backup).
 *
 * Usage (from server/):  npx ts-node src/scripts/migrateChats.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Chat from '../models/Chat';
import Message from '../models/Message';
import { ensureMigrated } from '../services/messageStore';

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI not set');
  await mongoose.connect(process.env.MONGO_URI);
  await Message.syncIndexes();

  const pending = await Chat.find({ migratedAt: { $exists: false } }).select('user').lean();
  console.log(`Chats to migrate: ${pending.length}`);

  let done = 0;
  for (const chat of pending) {
    await ensureMigrated(chat.user as any);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${pending.length}`);
  }

  const remaining = await Chat.countDocuments({ migratedAt: { $exists: false } });
  console.log(`Done. Migrated ${done}. Remaining unmigrated: ${remaining}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
