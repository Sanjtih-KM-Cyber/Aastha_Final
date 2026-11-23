import mongoose, { Schema, Document } from 'mongoose';
import { ensureEncrypted, decrypt } from '../utils/serverEncryption';

// Training pairs are encrypted at rest like chats (getters decrypt for the export job).
const enc = { set: ensureEncrypted, get: (v: any) => (typeof v === 'string' ? decrypt(v) : v) };

export interface ITrainingLog extends Document {
  userMood: string;
  persona: string;
  input: string;  // PII Scrubbed
  output: string; // AI Response
  createdAt: Date;
}

const trainingLogSchema = new Schema<ITrainingLog>({
  userMood: { type: String, index: true },
  persona: { type: String },
  input: { type: String, required: true, ...enc },
  output: { type: String, required: true, ...enc },
  createdAt: { type: Date, default: Date.now, expires: '365d' }
});

export default mongoose.model<ITrainingLog>('TrainingLog', trainingLogSchema);
