import mongoose from 'mongoose';

/**
 * "The Web", people in the user's life (ROADMAP S7).
 * These are THIRD PARTIES who never signed up, so everything identifying is encrypted at rest:
 *   name, alias, rapSheet[], mugshot  → serverEncryption.encrypt()
 *   nameHash                          → blindIndex(name), used for lookups / uniqueness
 * Always read/write through services/detectiveService.ts (it encrypts/decrypts and migrates legacy rows).
 */
const personSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {            // encrypted
    type: String,
    required: true
  },
  nameHash: {        // blind index of the normalised name
    type: String
  },
  alias: {           // encrypted
    type: String,
    default: ''
  },
  relationshipScore: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  verdict: {        // legacy 4-way label, still derived from `vibe` for older app versions
    type: String,
    enum: ['KEEPER', 'TOXIC', 'SUSPECT', 'NPC'],
    default: 'NPC'
  },
  role: {           // who they are to the user, chosen by the AI (services/detectiveService ROLES)
    type: String,
    default: 'other'
  },
  roleLabel: {      // encrypted free-text label when role = 'other' (e.g. "dance teacher")
    type: String,
    default: ''
  },
  vibe: {           // how the relationship feels, chosen by the AI (VIBES)
    type: String,
    default: 'unsure'
  },
  userEdited: {     // the user corrected role/vibe by hand → a re-scan won't overwrite it
    type: Boolean,
    default: false
  },
  rapSheet: [{       // each entry encrypted
    type: String
  }],
  mugshot: {         // encrypted data URL
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// One entry per person per user (by blind index). Partial so legacy rows without a hash don't collide.
personSchema.index(
  { userId: 1, nameHash: 1 },
  { unique: true, partialFilterExpression: { nameHash: { $exists: true } } }
);
// NOTE: the old unique index { userId: 1, name: 1 } may still exist in production, harmless, because
// encrypted names are unique strings. It can be dropped manually once all rows are migrated.

export const Person = mongoose.model('Person', personSchema);
