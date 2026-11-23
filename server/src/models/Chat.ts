import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  voice_note?: string;
}

/**
 * LEGACY: the whole conversation in one document. New messages live in the `Message`
 * collection (see services/messageStore.ts). Kept read-only as a rollback backup;
 * `migratedAt` is set once its messages have been copied.
 */
export interface IChat extends Document {
  user: mongoose.Types.ObjectId;
  messages: IMessage[];
  migratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  voice_note: { type: String }
});

const chatSchema = new Schema<IChat>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [messageSchema],
  migratedAt: { type: Date }
}, {
  timestamps: true
});

chatSchema.index({ user: 1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;