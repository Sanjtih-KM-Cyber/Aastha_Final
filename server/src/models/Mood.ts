import mongoose, { Document, Schema } from 'mongoose';

export interface IMood extends Document {
  user: mongoose.Types.ObjectId;
  mood: string;  // Encrypted Mood Label
  score: number; // Average Score for the day (1-10)
  count: number; // How many times user logged mood today (for averaging)
  timestamp: Date;
}

const moodSchema = new Schema<IMood>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { type: String, required: true }, 
  score: { type: Number, required: true },
  count: { type: Number, default: 1 }, // Default to 1 for new entries
  timestamp: { type: Date, default: Date.now }
});

// Index for efficient daily lookup
moodSchema.index({ user: 1, timestamp: -1 });

const Mood = mongoose.model<IMood>('Mood', moodSchema);
export default Mood;