import mongoose, { Document, Schema } from 'mongoose';

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
export interface ICloneMode {
  isActive: boolean; // Master Toggle
  isPersonaActive: boolean; // Text Mimicry Toggle
  isVoiceActive: boolean; // Voice Cloning Toggle
  targetPersona: string; // The "System Prompt" extracted from the screenshot
  voiceSample: string; // Base64 Audio Data
  usageCount: number; // Max 10 for free users
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
  name: string; // Plain text name for display
  email?: string; // DEPRECATED: Plain text email. Used for legacy lookup.
  emailHash?: string; // SHA-256 Hash of email for lookup
  username?: string; // Plain text username for lookup
  streak: number; // Feature tracking
  lastVisit: Date; // Feature tracking
  
  // --- Core Auth & Status ---
  passwordHash: string;
  diaryPasswordHash?: string;
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

  // Subscription
  subscriptionDate?: Date;
  subscriptionExpiresAt?: Date; // <--- NEW: Pro Plan Stacking
  voiceTopUpExpires?: Date; // <--- NEW: Voice Only Top-up Expiry
  paymentHistory: IPaymentRecord[];

  // Verification
  isVerified?: boolean;
  otpCode?: string;
  otpExpires?: Date;

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
  voiceSample: { type: String, select: false }, // Heavy field, exclude by default
  usageCount: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now }
}, { _id: false });

const voiceHugsSchema = new Schema({
  count: { type: Number, default: 0 },
  lastReset: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema<IUser>({
  // --- PII Index & Display Fields ---
  name: { type: String, required: true },
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
  securityQuestions: { type: [securityQuestionSchema], required: false },
  avatarTheme: { type: String, default: 'violet' },
  avatar: { type: String, required: false },
  wallpaper: { type: String, required: false },
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

  // Subscription
  subscriptionDate: { type: Date },
  subscriptionExpiresAt: { type: Date },
  voiceTopUpExpires: { type: Date }, // <--- NEW
  paymentHistory: { type: [paymentRecordSchema], default: [] },

  // Verification
  isVerified: { type: Boolean, default: false },
  otpCode: { type: String },
  otpExpires: { type: Date },

  // AI Persona Preference (Default: Aastha/Female)
  persona: { type: String, enum: ['aastha', 'aarav'], default: 'aastha' },
  moodStatus: { type: String, default: 'happy' },

  // Memory
  memorySummary: { type: String, default: "" },
  ghostNotificationSent: { type: Boolean, default: false },

  // Age Foundation
  dateOfBirth: { type: Date, required: false },

  // The Mirror (Secret Diary)
  mirrorEntries: [{
    date: { type: Date, default: Date.now },
    content: { type: String, required: true }
  }],

  // 1. Open Loops (Future Event Tracking)
  openLoops: [{
    event: { type: String, required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],

  // 2. The Lore System (Recurring Entities)
  lore: [{
    topic: { type: String, required: true },
    category: { type: String, enum: ['Villain', 'Bestie', 'Goal', 'Place', 'Lore'], default: 'Lore' },
    description: { type: String },
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
  faceTags: { type: Map, of: String, default: {} }
}, {
  timestamps: true,
});

const User = mongoose.model<IUser>('User', userSchema);
export default User;
