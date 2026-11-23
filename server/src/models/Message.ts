import mongoose, { Document, Schema } from 'mongoose';

/**
 * One document per chat message (replaces the single growing `Chat.messages[]` array,
 * which would eventually hit MongoDB's 16 MB document limit, ROADMAP R4).
 * `content` is encrypted with serverEncryption.encrypt().
 */
export interface IMessageDoc extends Document {
  user: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  voice_note?: string;
  isNudge?: boolean; // a follow-up the companion sent after they reacted / left it on seen (one per reply)
  isClone?: boolean; // reply written by Clone Mode (labelled "AI imitation" in the app)
  gif?: { url: string; width?: number; height?: number; title?: string; source?: string }; // GIF reaction (services/gifSearch)
  userReaction?: string; // the user's ❤️ 😂 👍 on an assistant message (services/reactions.ts)
  reactedAt?: Date;
}

const messageSchema = new Schema<IMessageDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    voice_note: { type: String },
    isClone: { type: Boolean },
    isNudge: { type: Boolean },
    gif: { type: { url: String, width: Number, height: Number, title: String, source: String, _id: false }, required: false },
    userReaction: { type: String },
    reactedAt: { type: Date },
  },
  { versionKey: false }
);

// Primary access pattern: a user's newest messages, paging backwards in time.
messageSchema.index({ user: 1, timestamp: -1, _id: -1 });
// "What landed" lookups: a user's most recent reactions only
messageSchema.index({ user: 1, reactedAt: -1 }, { partialFilterExpression: { reactedAt: { $exists: true } } });

const Message = mongoose.model<IMessageDoc>('Message', messageSchema);
export default Message;
