import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceNote extends Document {
  id: string; // Public UUID
  user: mongoose.Types.ObjectId;
  buffer: Buffer;
  encrypted?: boolean; // user recordings are AES-GCM encrypted at rest (7.4)
  mime?: string;       // default audio/wav (TTS); user recordings are webm/ogg/mp4
  createdAt: Date;
}

const voiceNoteSchema = new Schema<IVoiceNote>({
  id: { type: String, required: true, unique: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional if public link needed, but good for tracking
  buffer: { type: Buffer, required: true },
  encrypted: { type: Boolean, default: false },
  mime: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // 30 Days TTL
});

export default mongoose.model<IVoiceNote>('VoiceNote', voiceNoteSchema);
