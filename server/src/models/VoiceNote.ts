import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceNote extends Document {
  id: string; // Public UUID
  user: mongoose.Types.ObjectId;
  buffer: Buffer;
  createdAt: Date;
}

const voiceNoteSchema = new Schema<IVoiceNote>({
  id: { type: String, required: true, unique: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional if public link needed, but good for tracking
  buffer: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // 30 Days TTL
});

export default mongoose.model<IVoiceNote>('VoiceNote', voiceNoteSchema);
