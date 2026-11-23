import mongoose, { Document, Schema } from 'mongoose';
import { ensureEncrypted, decrypt, isEncrypted } from '../utils/serverEncryption';

/**
 * Transparent encryption for profile PII: assigning `user.name = 'Riya'` stores ciphertext, reading `user.name`
 * gives 'Riya'. `.lean()` reads bypass getters — wrap those in decrypt() (it is a no-op on plaintext).
 * Existing plaintext rows are encrypted by services/keyRotation.ts.
 */
const encString = { set: ensureEncrypted, get: (v: any) => (typeof v === 'string' ? decrypt(v) : v) };
const encDate = {
  set: (v: any) => {
    if (v === null || v === undefined || v === '') return v;
    if (typeof v === 'string' && isEncrypted(v)) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : ensureEncrypted(d.toISOString());
  },
  get: (v: any) => {
    if (v === null || v === undefined || v === '') return v;
    const d = new Date(decrypt(String(v)));
    return isNaN(d.getTime()) ? undefined : d;
  },
};

export interface ISecurityQuestion {
  question: string;
  answerHash: string;
}

export interface IPaymentRecord {
  orderId: string;
  paymentId: string;
  amount: number;
  status: string;
  date: Date;
}

// 1. Open Loops (Future Event Tracking)
export interface IOpenLoop {
  _id: string;
  event: string;
  date: Date;
  status: 'pending' | 'completed';
  createdAt: Date;
}

// 2. The Lore System (Recurring Entities)
export interface ILore {
  _id: string;
  topic: string;
  category: 'Villain' | 'Bestie' | 'Goal' | 'Place' | 'Lore';
  description?: string;
  mentionCount: number;
  isUnlocked: boolean;
  lastMentioned: Date;
}

// 3. Clone Mode (The Viral Hook)
export interface ICloneConsent {
  subject: 'self' | 'other';
  subjectName: string;          // encrypted
  attestedAt: Date;
  version: number;              // CLONE_CONSENT_VERSION at the time of consent
  attestations: string[];       // which statements the user confirmed
}
export interface ICloneMode {
  isActive: boolean; // Master Toggle (requires valid consent + style)
  isPersonaActive: boolean; // Text Mimicry Toggle
  isVoiceActive: boolean; // Voice Cloning Toggle (requires a voice sample)
  targetPersona: string; // LEGACY (unused) — replaced by styleNotes
  styleNotes?: string;   // encrypted JSON of style notes derived from a screenshot (screenshot itself is NOT stored)
  voiceSample: string; // encrypted data URL of the voice sample (biometric data — select:false)
  consent?: ICloneConsent;
  usageCount: number; // replies in the current rolling 24 h quota window (utils/dailyReset.ts)
  lastActive: Date;
}

// 4. Voice Hugs (The Comfort Hook)
export interface IVoiceHugs {
  count: number; // Max 3 per week for free
  lastReset: Date;
}

export interface IUser extends Document {
  // --- Encrypted Fields (Sensitive PII - Stored Encrypted) ---
  nameEncrypted?: string;
  emailEncrypted: string;
  usernameEncrypted?: string; // Add encrypted username back
  encryptionSalt?: string; // Random salt for Client-Side Key Derivation (New Users)

  // --- The Fortress (Master Key Architecture) ---
  masterKeyBlob1?: string; // Encrypted by Password (select: false)
  masterKeyBlob2?: string; // Encrypted by Security Question (select: false)

  // --- Indexed/Plain Fields (Used for Login, Display, or Features) ---
  name: string; // encrypted at rest (getter decrypts)
  email?: string; // DEPRECATED: never written any more; old values are removed by the rotation sweep
  emailHash?: string; // keyed blind index of the email (serverEncryption.blindIndex)
  username?: string; // Plain text username for lookup
  streak: number; // Feature tracking
  lastVisit: Date; // Feature tracking
  
  // --- Core Auth & Status ---
  passwordHash: string;
  diaryPasswordHash?: string;
  diaryReset?: { codeHash?: string; expires?: Date; attempts?: number; lockedUntil?: Date }; // diary forgot-password (controllers/diaryController.ts)
  securityQuestions?: ISecurityQuestion[];
  avatarTheme: string;
  avatar?: string;
  wallpaper?: string;
  credits: number;
  facts: string[];
  createdAt: Date;
  deletedAt?: Date;
  deletionReason?: string;
  
  // Business Logic Fields
  isPro: boolean;
  dailyPremiumUsage: number;
  lastUsageDate: Date;
  
  // Usage Limits (Split Token Budget)
  dailyGeminiCount: number;
  dailyGroqCount: number;
  lastMessageDate: Date;
  dailyResetAt?: Date; // last quota refill (utils/dailyReset.ts)
  quotaWindowStart?: Date | null; // rolling 24 h quota window start (first counted message)

  // Subscription
  subscriptionDate?: Date;
  subscriptionExpiresAt?: Date; // <--- NEW: Pro Plan Stacking
  voiceTopUpExpires?: Date; // <--- NEW: Voice Only Top-up Expiry
  paymentHistory: IPaymentRecord[];

  // Verification
  isVerified?: boolean;
  otpCode?: string;
  otpExpires?: Date;
  otpAttempts?: number;   // wrong OTP / security-answer tries since the last code was issued
  tokenVersion?: number;  // bump to revoke all existing JWTs for this user

  // AI Persona
  persona?: 'aastha' | 'aarav'; 
  moodStatus?: string; // Default: 'happy'

  // Memory
  memorySummary?: string;
  ghostNotificationSent?: boolean;

  // Age Foundation
  dateOfBirth?: Date;

  // The Mirror (Secret Diary)
  mirrorEntries?: { date: Date; content: string }[];

  // Active Memory & Lore
  openLoops: IOpenLoop[];
  lore: ILore[];

  // Onboarding
  isOnboardingComplete?: boolean;

  // --- DATA DONATION ---
  isDataDonationOn?: boolean;
  hasDonatedHistory?: boolean;

  // --- NEW FIELDS FOR "MONEY MACHINE" ---
  socialBattery: number; // 0-100
  cloneMode: ICloneMode;
  voiceHugs: IVoiceHugs;
  faceTags: Map<string, string>; // faceId -> personId (For "The Eyes")

  // --- ARCHITECTURE V2 ---
  inferredGender: 'Male' | 'Female' | 'Unknown'; // legacy, no longer used (S14)

  // Relationship engine (services/relationship.ts)
  styleProfile?: { avgWords: number; emojiRate: number; lowercase: number; hinglish: number; swears: number; abbrev: number; exclaim: number; lang?: string; langShare?: number; samples: number };
  bond?: { points: number; level: number; lastDayKey?: string; dayCount?: number; lastActiveAt?: Date; override?: number | null };
  // Language / region preference (A9)
  preferredLanguage?: string; // 'auto' | 'english' | 'hinglish' | 'hindi' | 'marathi' | ...
  region?: string;            // free text, e.g. "Pune" or "Kolkata"
  thinkingMode?: boolean;     // "think deeper" toggle
  gifsEnabled?: boolean;      // GIF / meme reactions in chat (services/gifSearch)
  pushSubscriptions?: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string; createdAt?: Date }[]; // Web Push (services/webPush.ts)
  // "Aastha reaches out first" (services/reachOut.ts) — follow-up text is encrypted
  followUps?: { _id?: any; text: string; dueDate: Date; status: 'pending' | 'asked' | 'sent' | 'dismissed'; createdAt?: Date }[];
  reachOut?: { enabled?: boolean; lastSentAt?: Date | null; lastCrisisAt?: Date | null };
  safetyIntroSeenAt?: Date; // "How Aastha keeps you safe" card (7.5)
  customMoods?: { id: string; label: string; emoji: string; score: number }[]; // label encrypted (services/customMoods.ts)
  windowControls?: 'mac' | 'windows'; // widget window buttons style, synced across devices
  nickname?: { value?: string; by?: 'aastha' | 'user'; setAt?: Date; announced?: boolean; off?: boolean }; // Bestie nickname (value encrypted)
  themeColor?: string;  // Sanctuary colour: preset id or #rrggbb (colour wheel), synced across devices
  appFont?: string;     // Sanctuary text font id (client/src/design/fonts.ts), synced across devices
  headingFont?: string; // Sanctuary heading font id
  legalConsent?: { termsVersion: string; privacyVersion: string; acceptedAt: Date }; // src/legal.ts
  timeZone?: string;        // device IANA zone, e.g. "Asia/Kolkata" (utils/timeZone.ts) — check-ins use local time
  dailyMessageCount: number;
  dailyVoiceCount: number; // <--- NEW: Daily Voice Note Limit for Free Users
  isListeningModeActive: boolean; // <--- NEW: Persistent STFU Mode
}

const securityQuestionSchema = new Schema({
  question: { type: String, required: true },
  answerHash: { type: String, required: true }
}, { _id: false });

const paymentRecordSchema = new Schema({
  orderId: { type: String, required: true },
  paymentId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true },
  date: { type: Date, default: Date.now }
}, { _id: false });

const cloneModeSchema = new Schema({
  isActive: { type: Boolean, default: false },
  isPersonaActive: { type: Boolean, default: true },
  isVoiceActive: { type: Boolean, default: true },
  targetPersona: { type: String, default: "" },
  styleNotes: { type: String, default: "" },
  voiceSample: { type: String, select: false }, // encrypted; heavy + biometric, exclude by default
  consent: {
    type: new Schema({
      subject: { type: String, enum: ['self', 'other'], required: true },
      subjectName: { type: String, required: true },
      attestedAt: { type: Date, required: true },
      version: { type: Number, required: true },
      attestations: { type: [String], default: [] },
    }, { _id: false }),
    default: undefined,
  },
  usageCount: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now }
}, { _id: false });

const voiceHugsSchema = new Schema({
  count: { type: Number, default: 0 },
  lastReset: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema<IUser>({
  // --- PII Index & Display Fields ---
  name: { type: String, required: true, ...encString }, // encrypted
  email: { type: String, required: false, lowercase: true, trim: true, index: true }, // Not unique anymore, handled by hash
  emailHash: { type: String, required: false, unique: true, sparse: true },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  
  // --- Encrypted Storage Fields ---
  nameEncrypted: { type: String, required: false }, // Will be set on registration
  emailEncrypted: { type: String, required: true, unique: true }, 
  usernameEncrypted: { type: String, required: false },
  encryptionSalt: { type: String, required: false },

  // --- The Fortress ---
  masterKeyBlob1: { type: String, select: false },
  masterKeyBlob2: { type: String, select: false },

  // --- Feature Fields ---
  streak: { type: Number, default: 0 }, // Initialize streak
  lastVisit: { type: Date, default: Date.now }, // Initialize lastVisit

  // --- Core Auth & Status ---
  passwordHash: { type: String, required: true },
  diaryPasswordHash: { type: String, required: false },
  diaryReset: {
    codeHash: { type: String, select: false },
    expires: Date,
    attempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  securityQuestions: { type: [securityQuestionSchema], required: false },
  avatarTheme: { type: String, default: 'violet' },
  avatar: { type: String, required: false, ...encString },    // encrypted (data URL)
  wallpaper: { type: String, required: false, ...encString }, // encrypted (data URL)
  credits: { type: Number, default: 20 },
  facts: { type: [String], default: [] },
  deletedAt: { type: Date, required: false },
  deletionReason: { type: String, required: false },
  
  // Daily Limits & Pro Status
  isPro: { type: Boolean, default: false },
  dailyPremiumUsage: { type: Number, default: 0 },
  lastUsageDate: { type: Date, default: Date.now },
  
  // Usage Limits (Split Token Budget)
  dailyGeminiCount: { type: Number, default: 0 },
  dailyGroqCount: { type: Number, default: 0 },
  lastMessageDate: { type: Date, default: Date.now },
  dailyResetAt: { type: Date },
  quotaWindowStart: { type: Date, default: null },

  // Subscription
  subscriptionDate: { type: Date },
  subscriptionExpiresAt: { type: Date },
  voiceTopUpExpires: { type: Date }, // <--- NEW
  paymentHistory: { type: [paymentRecordSchema], default: [] },

  // Verification
  isVerified: { type: Boolean, default: false },
  otpCode: { type: String },
  otpExpires: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  tokenVersion: { type: Number, default: 0 },

  // AI Persona Preference (Default: Aastha/Female)
  persona: { type: String, enum: ['aastha', 'aarav'], default: 'aastha' },
  moodStatus: { type: String, default: 'happy' },

  // Memory
  memorySummary: { type: String, default: "" },
  ghostNotificationSent: { type: Boolean, default: false },

  // Age Foundation
  dateOfBirth: { type: String, required: false, ...encDate }, // encrypted ISO date; reads back as a Date

  // The Mirror (Secret Diary)
  mirrorEntries: [{
    date: { type: Date, default: Date.now },
    content: { type: String, required: true, ...encString }
  }],

  // 1. Open Loops (Future Event Tracking)
  openLoops: [{
    event: { type: String, required: true, ...encString },
    date: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],

  // 2. The Lore System (Recurring Entities)
  lore: [{
    topic: { type: String, required: true, ...encString },
    category: { type: String, enum: ['Villain', 'Bestie', 'Goal', 'Place', 'Lore'], default: 'Lore' },
    description: { type: String, ...encString },
    mentionCount: { type: Number, default: 1 },
    isUnlocked: { type: Boolean, default: false }, // Set true when mentionCount >= 3
    lastMentioned: { type: Date, default: Date.now }
  }],

  // Onboarding (Default false = New users see it)
  isOnboardingComplete: { type: Boolean, default: false },

  // --- DATA DONATION ---
  isDataDonationOn: { type: Boolean, default: false },
  hasDonatedHistory: { type: Boolean, default: false },

  // --- NEW FIELDS ---
  socialBattery: { type: Number, default: 100, min: 0, max: 100 },
  cloneMode: { type: cloneModeSchema, default: () => ({ isActive: false, isPersonaActive: true, isVoiceActive: true, targetPersona: '', usageCount: 0 }) as any },
  voiceHugs: { type: voiceHugsSchema, default: () => ({ count: 0, lastReset: Date.now() }) as any },
  faceTags: { type: Map, of: String, default: {} },

  // --- ARCHITECTURE V2 ---
  inferredGender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' },
  styleProfile: {
    avgWords: Number, emojiRate: Number, lowercase: Number, hinglish: Number,
    swears: Number, abbrev: Number, exclaim: Number, lang: String, langShare: Number, samples: Number,
  },
  bond: {
    points: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    lastDayKey: String,
    dayCount: { type: Number, default: 0 },
    lastActiveAt: Date,
    override: { type: Number, default: null, min: 0, max: 4 },
  },
  preferredLanguage: { type: String, default: 'auto' },
  region: { type: String, ...encString }, // encrypted; length capped in the controller (a maxlength validator would see ciphertext)
  thinkingMode: { type: Boolean, default: false },
  gifsEnabled: { type: Boolean, default: true },
  pushSubscriptions: {
    type: [{ endpoint: String, keys: { p256dh: String, auth: String }, userAgent: String, createdAt: Date, _id: false }],
    default: [],
    select: false,
  },
  followUps: {
    type: [{ text: String, dueDate: Date, status: { type: String, enum: ['pending', 'asked', 'sent', 'dismissed'], default: 'pending' }, createdAt: Date }],
    default: [],
  },
  reachOut: {
    enabled: { type: Boolean, default: true },
    lastSentAt: Date,
    lastCrisisAt: Date,
  },
  safetyIntroSeenAt: Date,
  timeZone: { type: String, maxlength: 64 },
  customMoods: {
    type: [{ id: String, label: String, emoji: String, score: { type: Number, min: 1, max: 10 }, _id: false }],
    default: [],
  },
  windowControls: { type: String, enum: ['mac', 'windows'], default: 'windows' },
  nickname: {
    value: { type: String, ...encString }, // encrypted
    by: { type: String, enum: ['aastha', 'user'] },
    setAt: Date,
    announced: { type: Boolean, default: false },
    off: { type: Boolean, default: false },
  },
  themeColor: { type: String }, // no default: an unset account adopts the device's current colour once
  appFont: { type: String, default: 'jakarta' },
  headingFont: { type: String, default: 'fraunces' },
  legalConsent: { termsVersion: String, privacyVersion: String, acceptedAt: Date },
  dailyMessageCount: { type: Number, default: 0 },
  dailyVoiceCount: { type: Number, default: 0 }, // <--- NEW
  isListeningModeActive: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: false },
});

// Fast lookup for payment replay protection (a Razorpay payment/order can be redeemed only once)
userSchema.index({ 'paymentHistory.paymentId': 1 });
userSchema.index({ 'paymentHistory.orderId': 1 });

const User = mongoose.model<IUser>('User', userSchema);
export default User;
