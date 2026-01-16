import mongoose, { Document, Schema } from 'mongoose';

export interface IDiaryEntry extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  content: string;
  mood?: string;
  moodKeywords?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const diaryEntrySchema = new Schema<IDiaryEntry>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true }, // Encrypted
  content: { type: String, required: true }, // Encrypted
  mood: { type: String, required: false },
  moodKeywords: { type: String, required: false }, // Unencrypted keywords for Ghosting Service
  tags: [{ type: String }],
}, {
  timestamps: true
});

const Diary = mongoose.model<IDiaryEntry>('Diary', diaryEntrySchema);
export default Diary;