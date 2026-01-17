import mongoose from 'mongoose';

const personSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  alias: {
    type: String,
    default: 'Unknown Subject'
  },
  relationshipScore: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  verdict: {
    type: String,
    enum: ['KEEPER', 'TOXIC', 'SUSPECT', 'NPC'],
    default: 'NPC'
  },
  rapSheet: [{
    type: String
  }],
  mugshot: {
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index to ensure unique person names per user
personSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Person = mongoose.model('Person', personSchema);
