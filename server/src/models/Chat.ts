import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IChat extends Document {
  user: mongoose.Types.ObjectId;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new Schema<IChat>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [messageSchema]
}, {
  timestamps: true
});

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;