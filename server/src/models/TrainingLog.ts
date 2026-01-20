import mongoose, { Schema, Document } from 'mongoose';

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
  input: { type: String, required: true },
  output: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '365d' }
});

export default mongoose.model<ITrainingLog>('TrainingLog', trainingLogSchema);
