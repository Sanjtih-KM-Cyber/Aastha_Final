import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User';
import Diary from '../models/Diary';
import VoiceNote from '../models/VoiceNote';
import { deleteAllMessages, iterateAllMessages } from '../services/messageStore';
import Mood from '../models/Mood';
import { Person } from '../models/Person';
import TrainingLog from '../models/TrainingLog';
import { sanitizeForTraining } from './chatController';
import { AuthRequest } from '../middleware/authMiddleware';
import { encrypt, decrypt, needsReencryption, blindIndex, blindIndexCandidates } from '../utils/serverEncryption';
import { applyDailyReset, quotaResetsAt } from '../utils/dailyReset';
import { updateStreak } from '../utils/streak';
import { MIN_AGE, ageOn, consentIsCurrent, currentConsent } from '../legal';
import { PaymentArchive } from '../models/PaymentArchive';
import { cleanTimeZone } from '../utils/timeZone';
import { effectiveLevel, levelFor, BOND_LEVELS } from '../services/relationship';
import { SUPPORTED_LANGUAGES } from '../prompts/companion';
import { sendOTPEmail } from '../services/emailService';
import { verifyJwt } from '../utils/jwtKeys';
import { encryptMasterKey, decryptMasterKey, generateMasterKey } from '../utils/cryptoUtils';

/** Email lookup hash: KEYED blind index (rotatable via BLIND_INDEX_KEYS). Plain email is never stored. */
const hashEmail = (email: string) => blindIndex(email.toLowerCase().trim());
/** Old unkeyed SHA-256 (accounts created before 2026-11-23) — still matched until the rotation sweep rewrites it. */
const legacyEmailHash = (email: string) => crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
/** Match an email under the current blind key, any older blind key, or the legacy unkeyed hash. */
const emailHashLookup = (email: string) => ({ $in: [...blindIndexCandidates(email.toLowerCase().trim()), legacyEmailHash(email)] });

// `tv` (token version) lets us revoke every session for a user by bumping user.tokenVersion.
const generateToken = (user: { _id: any; tokenVersion?: number }) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server misconfiguration: Missing JWT_SECRET');
  }
  return jwt.sign({ id: user._id.toString(), tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Phase 3 fields the app needs (closeness, language, thinking toggle)
const relationshipFields = (user: any) => {
  const bond = user.bond || {};
  const level = effectiveLevel(bond);
  return {
    bond: {
      level,
      name: BOND_LEVELS[level].name,
      earnedLevel: levelFor(bond.points || 0),
      override: typeof bond.override === 'number' ? bond.override : null,
    },
    preferredLanguage: user.preferredLanguage || 'auto',
    region: user.region || '',
    thinkingMode: !!user.thinkingMode,
    gifsEnabled: user.gifsEnabled !== false,
    nickname: user.nickname?.value ? { value: user.nickname.value, by: user.nickname.by || 'aastha', off: !!user.nickname.off } : (user.nickname?.off ? { value: '', by: 'aastha', off: true } : null),
  };
};

// Brute-force protection: max wrong OTP / security-answer attempts per issued code.
const MAX_OTP_ATTEMPTS = 5;
const recordFailedAttempt = (userId: any) => User.updateOne({ _id: userId }, { $inc: { otpAttempts: 1 } });

const generateResetVerifiedToken = (id: string) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server misconfiguration: Missing JWT_SECRET');
  }
  // Short expiry for reset token (15 mins)
  return jwt.sign({ id, purpose: 'reset-verified' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

const generateOTP = () => {
    // Generates a cryptographically secure 6-digit number
    return crypto.randomInt(100000, 1000000).toString();
};

const escapeRegex = (text: string) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// --- REGISTER ---
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, username, password, diaryPassword, securityQuestions, dateOfBirth, acceptTerms } = (req as any).body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof username !== 'string') {
        (res as any).status(400).json({ message: 'Invalid input format. Strings required.' });
        return;
    }

    if (!name || !email || !password || !username || !dateOfBirth) {
      (res as any).status(400).json({ message: 'Please add all required fields (including Username and Date of Birth)' });
      return;
    }

    // Validate DOB
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
        (res as any).status(400).json({ message: 'Invalid Date of Birth.' });
        return;
    }
    // Adults only (Terms §2, Privacy §10): DPDP Act s.9 needs verifiable parental consent for under-18s
    if (ageOn(dob) < MIN_AGE || dob.getTime() > Date.now()) {
        (res as any).status(400).json({ message: `Aastha is for adults (${MIN_AGE}+). If you're going through something hard, please reach out to Tele-MANAS on 14416 — it's free and open 24/7.` });
        return;
    }
    // Informed consent to the Terms + Privacy Policy is required and recorded (version + time)
    if (acceptTerms !== true) {
        (res as any).status(400).json({ message: 'Please agree to the Terms and Privacy Policy to create an account.' });
        return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();
    const emailHash = hashEmail(cleanEmail);

    // Unique Checks
    const emailExists = await User.findOne({ $or: [{ emailHash: emailHashLookup(cleanEmail) }, { email: cleanEmail }] });
    if (emailExists) {
        (res as any).status(400).json({ message: 'Email already registered' });
        return;
    }

    if (cleanUsername) {
        const usernameExists = await User.findOne({ username: cleanUsername });
        if (usernameExists) {
            (res as any).status(400).json({ message: 'Username already taken' });
            return;
        }
    }

    const encryptionSalt = crypto.randomUUID();
    // Optimization: Reduced salt rounds to 8 for faster performance on Render
    // UPDATE: The Fortress requires 12 rounds for stronger security.
    // REVERT: Back to 10 for performance.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let hashedDiaryPassword = undefined;
    if (diaryPassword) hashedDiaryPassword = await bcrypt.hash(diaryPassword, salt);

    let processedSecurityQuestions = undefined;
    // THE FORTRESS: Generate Master Key
    const masterKey = generateMasterKey();
    let masterKeyBlob1 = undefined;
    let masterKeyBlob2: string | undefined = undefined;

    // Blob1: Encrypt with Password
    masterKeyBlob1 = await encryptMasterKey(masterKey, password);

    if (securityQuestions && Array.isArray(securityQuestions)) {
      processedSecurityQuestions = await Promise.all(securityQuestions.map(async (q: any) => {
          const answerClean = q.answer.toLowerCase().trim();
          // Blob2: Encrypt with Security Answer (using the first one for simplicity as per requirements)
          if (!masterKeyBlob2) {
              masterKeyBlob2 = await encryptMasterKey(masterKey, answerClean);
          }
          return {
            question: q.question,
            answerHash: await bcrypt.hash(answerClean, salt)
          };
      }));
    }

    // Prepare OTP upfront to avoid secondary write
    const otp = generateOTP();
    const otpCodeHash = await bcrypt.hash(otp, 8); // Optimized
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name: name,
      emailHash: emailHash,
      username: cleanUsername,
      emailEncrypted: encrypt(email),
      usernameEncrypted: cleanUsername ? encrypt(username) : undefined,
      encryptionSalt: encryptionSalt,
      passwordHash: hashedPassword,
      diaryPasswordHash: hashedDiaryPassword,
      securityQuestions: processedSecurityQuestions,
      masterKeyBlob1: masterKeyBlob1,
      masterKeyBlob2: masterKeyBlob2,
      isPro: false,
      dailyPremiumUsage: 0,
      streak: 1, 
      lastVisit: new Date(),
      dateOfBirth: dob,
      legalConsent: currentConsent(),
      // --- STRICT VERIFICATION MODE ---
      isVerified: false,
      otpCode: otpCodeHash,
      otpExpires: otpExpires
    });

    if (user) {
        console.log(`[Auth] Strict Registration: Sending OTP to ${cleanEmail}`);
        // Fire and forget email
        sendOTPEmail(cleanEmail, otp).catch(e => console.error("[Auth] Background Email Error:", e));

        (res as any).status(201).json({
            message: 'Account created. Verification required.',
            requiresVerification: true,
            email: cleanEmail
        });
    }
  } catch (error) {
    console.error("Register Error:", error);
    (res as any).status(500).json({ message: 'Server error' });
  }
};

// --- LOGIN ---
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = (req as any).body;

    if (typeof identifier !== 'string' || typeof password !== 'string') {
        (res as any).status(400).json({ message: 'Invalid input format. Strings required.' });
        return;
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const identifierHash = hashEmail(cleanIdentifier);

    // LOOKUP
    // Optimized: Removed Regex to prevent table scans. Used Exact Match which utilizes index.
    let user = await User.findOne({
      $or: [
        { emailHash: emailHashLookup(cleanIdentifier) },
        { email: cleanIdentifier },
        { username: cleanIdentifier }
      ]
    }).select('+masterKeyBlob1'); // Explicitly select hidden field for Logic

    // --- MIGRATION ON LOGIN ---
    // Plaintext email (old accounts) → encrypted only; old/unkeyed hash → current keyed hash.
    if (user && user.emailHash) {
        const plainEmail = (decrypt(user.emailEncrypted || '') || user.email || '').toLowerCase().trim();
        let changed = false;
        if (plainEmail && user.emailHash !== hashEmail(plainEmail)) { user.emailHash = hashEmail(plainEmail); changed = true; }
        if (user.email) {
            if (!user.emailEncrypted) user.emailEncrypted = encrypt(user.email);
            user.email = undefined; changed = true;
        }
        if (changed) await user.save();
    }
    if (user && user.email && !user.emailHash) {
        const emailToMigrate = user.email.toLowerCase().trim();
        user.emailHash = hashEmail(emailToMigrate);
        if (!user.emailEncrypted) user.emailEncrypted = encrypt(emailToMigrate);

        user.email = undefined;
        user.isVerified = false; // Force verification for legacy
        await user.save();
    }

    // --- ONBOARDING MIGRATION (Legacy Users) ---
    // If field is missing, set to true so they skip tour. New users (schema default false) will see it.
    if (user && user.isOnboardingComplete === undefined) {
        user.isOnboardingComplete = true;
        await user.save();
    }

    if (user && user.deletedAt) {
       const daysSinceDelete = (new Date().getTime() - new Date(user.deletedAt).getTime()) / (1000 * 3600 * 24);
       if (daysSinceDelete > 10) {
           (res as any).status(403).json({ message: 'Account permanently deleted.' });
           return;
       } else {
           user.deletedAt = undefined;
           user.deletionReason = undefined;
           await user.save();
       }
    }

    // 1. Authenticate Password
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      
        // --- STRICT VERIFICATION CHECK ---
        if (user.isVerified !== true) {
             const userEmail = decrypt(user.emailEncrypted) || user.email || cleanIdentifier;
             console.log(`[Auth] Unverified login attempt for ${cleanIdentifier}.`);

             if (user.otpExpires && user.otpExpires > new Date()) {
                 (res as any).status(403).json({
                     message: 'Verification pending. Please check your email.',
                     requiresVerification: true,
                     email: userEmail
                 });
                 return;
             }

             const otp = generateOTP();
             user.otpCode = await bcrypt.hash(otp, 8); // Optimized
             user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
             user.otpAttempts = 0;
             await user.save();

             sendOTPEmail(userEmail, otp).catch(e => console.error("[Auth] Login OTP Error:", e));

             (res as any).status(403).json({
                 message: 'Verification code sent.',
                 requiresVerification: true,
                 email: userEmail
             });
             return;
        }

      // --- PROCEED TO LOGIN (Verified Users Only) ---
      let needsSave = false;

      // --- LAZY MIGRATION: RE-ENCRYPT DATA ---
      // Only re-encrypt when the value is NOT readable with the primary key (real rotation),
      // instead of on every login (ciphertexts always differ because of random IVs).
      if (user.emailEncrypted && needsReencryption(user.emailEncrypted)) {
          console.log(`[Key Rotation] Migrating email for user ${user._id} to new key.`);
          user.emailEncrypted = encrypt(decrypt(user.emailEncrypted));
          needsSave = true;
      }

      if (user.usernameEncrypted && needsReencryption(user.usernameEncrypted)) {
          user.usernameEncrypted = encrypt(decrypt(user.usernameEncrypted));
          needsSave = true;
      }

      let decryptedMasterKeyHex = null;

      // THE FORTRESS: Silent Migration or Decryption
      if (user.masterKeyBlob1) {
          // Decrypt existing key
          try {
              const mkBuffer = await decryptMasterKey(user.masterKeyBlob1, password);
              decryptedMasterKeyHex = mkBuffer.toString('hex');
          } catch (e) {
              console.error("Master Key Decryption Failed:", e);
              // Fallback? If pass is correct but blob fails, it's corrupted.
          }
      } else {
          // Silent Migration (Legacy User)
          console.log(`[The Fortress] Migrating legacy user: ${user._id}`);
          const newMasterKey = generateMasterKey();
          user.masterKeyBlob1 = await encryptMasterKey(newMasterKey, password);

          // NEW: Attempt to migrate Blob2 if security questions exist but are hashed
          // NOTE: We cannot decrypt the existing hashes to create Blob2 immediately.
          // The user will be prompted to "Update Security" later to generate Blob2.
          // For now, they rely on Blob1 (Password).

          decryptedMasterKeyHex = newMasterKey.toString('hex');
          needsSave = true;
      }

      if (!user.emailEncrypted && user.email) {
          user.emailEncrypted = encrypt(user.email);
          needsSave = true;
      }
      
      if (!user.username) {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const baseName = user.name ? user.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) : 'user';
          user.username = `${baseName}${randomSuffix}`;
          user.usernameEncrypted = encrypt(user.username);
          needsSave = true;
      } else if (!user.usernameEncrypted) {
          user.usernameEncrypted = encrypt(user.username);
          needsSave = true;
      }

      // STREAK on the user's LOCAL calendar (device zone from the X-Time-Zone header) — utils/streak.ts
      const now = new Date();
      const loginTz = cleanTimeZone((req as any).query?._tz || (req as any).headers?.['x-time-zone']);
      if (loginTz && (user as any).timeZone !== loginTz) (user as any).timeZone = loginTz;
      updateStreak(user, now);
      needsSave = true;
      
      // Update Visit Time Logic & Reset Ghost Status
      user.lastVisit = now; // Always update on login
      user.ghostNotificationSent = false;
      user.moodStatus = 'neutral'; // fresh start each session; the brain re-reads their mood from the chat
      needsSave = true;

      // Lazy Migration: Upgrade Hash Strength
      if (user.passwordHash.startsWith('$2a$08$')) {
          console.log(`[The Fortress] Upgrading hash for user ${user._id}`);
          const newSalt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(password, newSalt);
          needsSave = true;
      }

      // Reset Daily Limits
      if (user.dailyPremiumUsage === undefined) { user.dailyPremiumUsage = 0; needsSave = true; }
      if (user.dailyMessageCount === undefined) { user.dailyMessageCount = 0; needsSave = true; }
      if (user.isPro === undefined) { user.isPro = false; needsSave = true; }

      if (applyDailyReset(user, now)) needsSave = true;

      if (needsSave) await user.save();

      const token = generateToken(user);
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

      (res as any).cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      
      // ✅ ADDED TOKEN TO RESPONSE BODY
      (res as any).json({
        token: token, 
        _id: user._id,
        name: user.name, 
        email: decrypt(user.emailEncrypted) || user.email,
        username: user.username || undefined,
        requireUsername: !user.username,
        hasDiarySetup: !!user.diaryPasswordHash,
        isPro: user.isPro,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        voicePassExpiresAt: user.voiceTopUpExpires,
        ...relationshipFields(user),
        credits: user.isPro ? 9999 : Math.max(0, 16 - (user.dailyMessageCount || 0)),
        quotaResetsAt: user.isPro ? null : quotaResetsAt(user),
        safetyIntroSeen: !!(user as any).safetyIntroSeenAt,
        windowControls: (user as any).windowControls || 'windows',
        appFont: (user as any).appFont || 'jakarta',
        headingFont: (user as any).headingFont || 'fraunces',
        themeColor: (user as any).themeColor || null,
        legalConsentCurrent: consentIsCurrent((user as any).legalConsent),
        streak: user.streak,
        avatar: user.avatar,
        wallpaper: user.wallpaper,
        persona: user.persona || 'aastha',
        moodStatus: user.moodStatus,
        masterKey: decryptedMasterKeyHex, // Zero-Knowledge Return
        isOnboardingComplete: user.isOnboardingComplete,
        isDataDonationOn: user.isDataDonationOn,
        createdAt: user.createdAt,
        encryptionSalt: user.encryptionSalt,
        securityQuestions: user.securityQuestions?.map((q: any) => ({ question: q.question }))
      });
    } else {
      (res as any).status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error("Login Error:", error);
    (res as any).status(500).json({ message: 'Server error' });
  }
};

// --- LOGOUT ---
export const logoutUser = (req: Request, res: Response) => {
  (res as any).cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
  (res as any).status(200).json({ message: 'Logged out' });
};

// --- GET ME ---
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { (res as any).status(401).json({ message: 'Not authorized' }); return; }
    
    const user = await User.findById(req.user._id);
    if (!user) return (res as any).status(404).json({ message: 'User not found' });

    if (user.email && !user.emailHash) {
        user.emailHash = hashEmail(user.email);
        if (!user.emailEncrypted) user.emailEncrypted = encrypt(user.email);
        user.email = undefined;
        await user.save();
    }

    if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);
    
    if (!user.username) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const baseName = user.name ? user.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) : 'user';
        user.username = `${baseName}${randomSuffix}`;
        user.usernameEncrypted = encrypt(user.username);
    } else if (!user.usernameEncrypted) {
        user.usernameEncrypted = encrypt(user.username);
    }

    if (!user.streak) user.streak = 1;
    if (!user.lastVisit) user.lastVisit = new Date(); 
    if (user.dailyPremiumUsage === undefined) user.dailyPremiumUsage = 0;
    if (user.dailyMessageCount === undefined) user.dailyMessageCount = 0;
    if (user.isPro === undefined) user.isPro = false;
    
    const now = new Date();
    applyDailyReset(user, now);
    
    // Streak on the user's local calendar (utils/streak.ts)
    updateStreak(user, now);
    
    await user.save();


    (res as any).status(200).json({
        _id: user._id,
        name: user.name,
        email: decrypt(user.emailEncrypted) || "Encrypted",
        username: user.username || undefined,
        hasDiarySetup: !!user.diaryPasswordHash,
        isPro: user.isPro,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        voicePassExpiresAt: user.voiceTopUpExpires,
        ...relationshipFields(user),
        credits: user.isPro ? 9999 : Math.max(0, 16 - (user.dailyMessageCount || 0)),
        quotaResetsAt: user.isPro ? null : quotaResetsAt(user),
        safetyIntroSeen: !!(user as any).safetyIntroSeenAt,
        windowControls: (user as any).windowControls || 'windows',
        appFont: (user as any).appFont || 'jakarta',
        headingFont: (user as any).headingFont || 'fraunces',
        themeColor: (user as any).themeColor || null,
        legalConsentCurrent: consentIsCurrent((user as any).legalConsent),
        streak: user.streak,
        avatar: user.avatar,
        wallpaper: user.wallpaper,
        persona: user.persona || 'aastha',
        isOnboardingComplete: user.isOnboardingComplete,
        isDataDonationOn: user.isDataDonationOn,
        createdAt: user.createdAt,
        encryptionSalt: user.encryptionSalt,
        securityQuestions: user.securityQuestions?.map((q: any) => ({ question: q.question }))
    });
  } catch (error) { 
      console.error("GetMe Error:", error);
      (res as any).status(500).json({message: 'Server Error'}); 
  }
};

// --- UPDATE PROFILE ---
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { name, username, avatar, wallpaper, persona, preferredLanguage, region, closeness, thinkingMode, gifsEnabled } = (req as any).body;
        const user = await User.findById(req.user._id);
        if (!user) return (res as any).status(404).json({ message: 'User not found' });

        if (name !== undefined) user.name = name;
        if (avatar !== undefined) user.avatar = avatar;
        if (wallpaper !== undefined) user.wallpaper = wallpaper;
        if (persona !== undefined) user.persona = persona;

        // Phase 3: language/region (A9), closeness override + thinking toggle (A6)
        if (preferredLanguage !== undefined) {
            const lang = String(preferredLanguage).toLowerCase();
            if (!SUPPORTED_LANGUAGES.includes(lang)) return (res as any).status(400).json({ message: 'Unsupported language' });
            user.preferredLanguage = lang;
        }
        if (region !== undefined) user.region = String(region || '').trim().slice(0, 60);
        if (closeness !== undefined) {
            // null / "auto" = let the bond grow naturally; 0..4 = fixed closeness chosen by the user
            const value = closeness === null || closeness === 'auto' ? null : Number(closeness);
            if (value !== null && !(Number.isInteger(value) && value >= 0 && value <= 4)) {
                return (res as any).status(400).json({ message: 'Invalid closeness' });
            }
            user.bond = { ...((user.bond as any)?.toObject?.() || user.bond || { points: 0, level: 0 }), override: value } as any;
            user.markModified('bond');
        }
        if (thinkingMode !== undefined) user.thinkingMode = !!thinkingMode;
        if (gifsEnabled !== undefined) user.gifsEnabled = !!gifsEnabled;
        
        if (username) {
            const cleanUsername = username.toLowerCase().trim();
            if (cleanUsername !== user.username) {
                const exists = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
                if (exists) return (res as any).status(400).json({ message: 'Username taken' });
                
                user.username = cleanUsername;
                user.usernameEncrypted = encrypt(username);
            }
        }
        
        await user.save();

        (res as any).json({
            _id: user._id,
            name: user.name,
            email: decrypt(user.emailEncrypted),
            username: user.username,
            hasDiarySetup: !!user.diaryPasswordHash,
            isPro: user.isPro,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        voicePassExpiresAt: user.voiceTopUpExpires,
        ...relationshipFields(user),
            credits: user.isPro ? 9999 : Math.max(0, 16 - (user.dailyMessageCount || 0)),
            quotaResetsAt: user.isPro ? null : quotaResetsAt(user),
            safetyIntroSeen: !!(user as any).safetyIntroSeenAt,
            windowControls: (user as any).windowControls || 'windows',
            appFont: (user as any).appFont || 'jakarta',
            headingFont: (user as any).headingFont || 'fraunces',
            themeColor: (user as any).themeColor || null,
            legalConsentCurrent: consentIsCurrent((user as any).legalConsent),
            streak: user.streak,
            avatar: user.avatar,
            wallpaper: user.wallpaper,
            persona: user.persona || 'aastha',
            isOnboardingComplete: user.isOnboardingComplete,
            isDataDonationOn: user.isDataDonationOn,
            createdAt: user.createdAt,
            encryptionSalt: user.encryptionSalt,
            securityQuestions: user.securityQuestions?.map((q: any) => ({ question: q.question }))
        });
    } catch (e) { 
        console.error("Update Profile Error:", e);
        (res as any).status(500).json({ message: 'Error updating profile' }); 
    }
};


export const softDeleteUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Not authorized' });
    const { reason } = (req as any).body;

    // --- NUCLEAR DELETE: CASCADE WIPE ---
    // Wipe: User, Chat, Diary, Mood, Person
    const userId = req.user._id;

    console.log(`[Nuclear Delete] Wiping data for user ${userId}`);

    // Tax/accounting law: keep the bare transaction records (no name/email/content) — Privacy Policy §8
    const paying: any = await User.findById(userId).select('emailHash paymentHistory').lean();
    if (paying?.paymentHistory?.length) {
        await PaymentArchive.create({
            emailHash: paying.emailHash,
            records: paying.paymentHistory.map((p: any) => ({ orderId: p.orderId, paymentId: p.paymentId, amount: p.amount, status: p.status, date: p.date })),
        });
    }

    await Promise.all([
        User.findByIdAndDelete(userId),
        deleteAllMessages(userId),
        Diary.deleteMany({ user: userId }),
        Mood.deleteMany({ user: userId }),
        Person.deleteMany({ userId: userId }),
        VoiceNote.deleteMany({ user: userId })
    ]);

    (res as any).cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    (res as any).status(200).json({ message: 'Account permanently deleted and data wiped.' });
  } catch (error) { (res as any).status(500).json({ message: 'Server Error' }); }
};

// --- FORGOT PASSWORD FLOW ---

export const initiateReset = async (req: Request, res: Response) => {
  try {
    const { email } = (req as any).body;
    const cleanEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(cleanEmail);

    const user = await User.findOne({ $or: [{ emailHash: emailHashLookup(cleanEmail) }, { email: cleanEmail }] });

    if (!user) {
         // SECURITY: Fake delay to prevent enumeration
         const delay = Math.floor(Math.random() * 500) + 300;
         await new Promise(r => setTimeout(r, delay));
         // Return success even if not found
         return (res as any).status(200).json({ message: 'If account exists, OTP sent.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otpCode = await bcrypt.hash(otp, 8);
    user.otpExpires = otpExpires;
    user.otpAttempts = 0;
    await user.save();

    console.log(`[Reset] Sending OTP to ${cleanEmail}`);
    sendOTPEmail(cleanEmail, otp, 'reset').catch(e => console.error("[Reset] Email Error:", e));

    (res as any).status(200).json({ message: 'OTP sent.' });

  } catch (error) { (res as any).status(500).json({ message: 'Server Error' }); }
};

export const verifyResetOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = (req as any).body;
        if (!email || !otp) return (res as any).status(400).json({ message: 'Email and OTP required' });

        const cleanEmail = email.toLowerCase().trim();
        const emailHash = hashEmail(cleanEmail);

        const user = await User.findOne({
            $or: [{ emailHash: emailHashLookup(cleanEmail) }, { email: cleanEmail }]
        });

        if (!user || !user.otpCode || !user.otpExpires) {
             return (res as any).status(400).json({ message: 'Invalid request.' });
        }

        if (new Date() > user.otpExpires) {
             return (res as any).status(400).json({ message: 'OTP expired.' });
        }

        if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
             return (res as any).status(429).json({ message: 'Too many wrong attempts. Please request a new code.' });
        }

        const isValid = await bcrypt.compare(String(otp), user.otpCode);
        if (!isValid) {
            await recordFailedAttempt(user._id);
            return (res as any).status(400).json({ message: 'Invalid code.' });
        }

        // Retrieve Security Question
        let question = "What is your favorite color?"; // Fallback
        if (user.securityQuestions && user.securityQuestions.length > 0) {
            question = user.securityQuestions[0].question;
        }

        // Generate Verified Token
        const resetToken = generateResetVerifiedToken((user._id as any).toString());

        // Clear OTP
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        (res as any).status(200).json({
            message: 'OTP verified.',
            question: question,
            resetToken: resetToken
        });

    } catch (e) {
        console.error("Verify Reset OTP Error:", e);
        (res as any).status(500).json({ message: 'Server error' });
    }
};

export const completeReset = async (req: Request, res: Response) => {
  try {
    const { email, answer, newPassword, resetToken } = (req as any).body;

    if (!email || !answer || !newPassword || !resetToken) {
        return (res as any).status(400).json({ message: 'Missing fields.' });
    }

    // Verify Token
    if (!process.env.JWT_SECRET) throw new Error("Missing Secret");
    let decoded: any;
    try {
        decoded = verifyJwt(resetToken);
        if (decoded.purpose !== 'reset-verified') throw new Error('Invalid token purpose');
    } catch (e) {
        return (res as any).status(401).json({ message: 'Session expired. Please verify OTP again.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(cleanEmail);

    const user = await User.findOne({ $or: [{ emailHash: emailHashLookup(cleanEmail) }, { email: cleanEmail }] }).select('+masterKeyBlob2');

    if (!user || (user._id as any).toString() !== decoded.id) {
        return (res as any).status(403).json({ message: 'Invalid user context.' });
    }

    // Fake Verification for Non-Existent Users (Timing Attack Protection)
    if (!user.securityQuestions || user.securityQuestions.length === 0 || !user.securityQuestions[0].answerHash) {
         await bcrypt.compare(answer, "$2a$10$abcdefghijklmnopqrstuvwxyz123456"); // Fake compare
         return (res as any).status(400).json({ message: 'Incorrect answer.' });
    }

    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        return (res as any).status(429).json({ message: 'Too many wrong attempts. Please restart the reset.' });
    }

    const cleanAnswer = answer.toLowerCase().trim();
    const isValid = await bcrypt.compare(cleanAnswer, user.securityQuestions[0].answerHash);

    if (!isValid) {
        await recordFailedAttempt(user._id);
        return (res as any).status(401).json({ message: 'Incorrect answer.' });
    }

    // THE FORTRESS: Recover Master Key
    let recoverySuccess = false;
    if (user.masterKeyBlob2) {
        try {
            const recoveredKey = await decryptMasterKey(user.masterKeyBlob2, cleanAnswer);
            // Re-encrypt for new password (Blob1)
            user.masterKeyBlob1 = await encryptMasterKey(recoveredKey, newPassword);
            // Re-encrypt for security answer (refresh Blob2) - optional but good for consistency
            user.masterKeyBlob2 = await encryptMasterKey(recoveredKey, cleanAnswer);
            recoverySuccess = true;
        } catch (e) {
            console.error("Master Key Recovery Failed during Reset:", e);
        }
    }

    if (!recoverySuccess && user.masterKeyBlob2) {
        // ABORT: Data Recovery Failed.
        return (res as any).status(500).json({
            message: "Critical: Unable to recover data keys. Resetting password now will wipe your diary. Contact support or confirm data wipe."
        });
    }

    // Force OTP on next login
    user.isVerified = true;

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.otpAttempts = 0;
    // Log out every existing session (a stolen token must not survive a password reset)
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    (res as any).status(200).json({ message: 'Password reset successful.' });
  } catch (error) { (res as any).status(500).json({ message: 'Server Error' }); }
};

export const verifyDiaryPassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Not authorized' });
    const { diaryPassword } = (req as any).body;
    const user = await User.findById(req.user._id);
    if (!user || !user.diaryPasswordHash) return (res as any).status(400).json({ message: 'Diary setup not found' });
    const isValid = await bcrypt.compare(diaryPassword, user.diaryPasswordHash);
    if (isValid) (res as any).json({ success: true });
    else (res as any).status(403).json({ success: false, message: 'Invalid diary password' });
  } catch (error) { (res as any).status(500).json({ message: 'Server error' }); }
};

// --- OTP VERIFICATION ---
export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = (req as any).body;
        const cleanEmail = email.toLowerCase().trim();
        const emailHash = hashEmail(cleanEmail);

        console.log(`[Auth] Verifying OTP for ${cleanEmail}.`);
        const user = await User.findOne({ 
            $or: [
                { emailHash: emailHashLookup(cleanEmail) },
                { email: cleanEmail },
                { username: cleanEmail }
            ]
        });

        if (!user) return (res as any).status(404).json({ message: 'User not found' });
        if (user.isVerified) return (res as any).status(200).json({ message: 'Already verified' });

        if (!user.otpCode || !user.otpExpires) {
            return (res as any).status(400).json({ message: 'No OTP requested.' });
        }

        if (new Date() > user.otpExpires) {
            return (res as any).status(400).json({ message: 'OTP expired.' });
        }

        if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
            return (res as any).status(429).json({ message: 'Too many wrong attempts. Please request a new code.' });
        }

        const otpString = String(otp);
        const isValid = await bcrypt.compare(otpString, user.otpCode);

        if (!isValid) {
            await recordFailedAttempt(user._id);
            return (res as any).status(400).json({ message: 'Invalid code.' });
        }

        // Success
        user.isVerified = true;
        user.otpCode = undefined;
        user.otpExpires = undefined;
        
        if (!user.streak) user.streak = 1; 
        if (!user.lastVisit) user.lastVisit = new Date(); 
        
        await user.save();

        // Issue Token
        const token = generateToken(user);
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        (res as any).cookie('jwt', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        // ✅ ADDED TOKEN TO RESPONSE BODY
        (res as any).json({
            token: token,
            _id: user._id,
            name: user.name,
            email: decrypt(user.emailEncrypted),
            username: user.username,
            hasDiarySetup: !!user.diaryPasswordHash,
            isPro: user.isPro,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        voicePassExpiresAt: user.voiceTopUpExpires,
        ...relationshipFields(user),
            credits: user.isPro ? 9999 : Math.max(0, 16 - (user.dailyMessageCount || 0)),
            quotaResetsAt: user.isPro ? null : quotaResetsAt(user),
            safetyIntroSeen: !!(user as any).safetyIntroSeenAt,
            windowControls: (user as any).windowControls || 'windows',
            appFont: (user as any).appFont || 'jakarta',
            headingFont: (user as any).headingFont || 'fraunces',
            themeColor: (user as any).themeColor || null,
            legalConsentCurrent: consentIsCurrent((user as any).legalConsent),
            streak: user.streak,
            avatar: user.avatar,
            wallpaper: user.wallpaper,
            isOnboardingComplete: user.isOnboardingComplete,
            isDataDonationOn: user.isDataDonationOn,
            createdAt: user.createdAt,
            encryptionSalt: user.encryptionSalt,
            securityQuestions: user.securityQuestions?.map((q: any) => ({ question: q.question }))
        });

    } catch (e) {
        console.error("Verify OTP Error:", e);
        (res as any).status(500).json({ message: 'Server error' });
    }
};

export const resendOTP = async (req: Request, res: Response) => {
    try {
        const { email } = (req as any).body;
        const cleanEmail = email.toLowerCase().trim();
        const emailHash = hashEmail(cleanEmail);

        const user = await User.findOne({ 
             $or: [
                 { emailHash: emailHashLookup(cleanEmail) },
                 { email: cleanEmail },
                 { username: cleanEmail }
             ]
        });

        if (!user) return (res as any).status(404).json({ message: 'User not found' });
        if (user.isVerified) return (res as any).status(400).json({ message: 'Already verified' });

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.otpCode = await bcrypt.hash(otp, 10);
        user.otpExpires = otpExpires;
        user.otpAttempts = 0;
        await user.save();

        sendOTPEmail(cleanEmail, otp).catch(e => console.error("[Auth] Background Email Error:", e));

        (res as any).status(200).json({ message: 'Code resent' });
    } catch (e) {
        console.error("Resend OTP Error:", e);
        (res as any).status(500).json({ message: 'Server error' });
    }
};

export const changeDiaryPassword = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { oldPassword, newPassword } = (req as any).body;

        const user = await User.findById(req.user._id);
        if (!user || !user.diaryPasswordHash) return (res as any).status(400).json({ message: 'Diary setup not found.' });

        const isValid = await bcrypt.compare(oldPassword, user.diaryPasswordHash);
        if (!isValid) return (res as any).status(401).json({ message: 'Incorrect old password.' });

        // THE FORTRESS: Safe to change password without re-encryption
        // because data is now encrypted by Master Key (Blob1/Blob2), not this password directly.
        const salt = await bcrypt.genSalt(10);
        user.diaryPasswordHash = await bcrypt.hash(newPassword, salt);
        await user.save();

        (res as any).json({ success: true, message: 'Diary password updated.' });

    } catch (e) {
        (res as any).status(500).json({ message: 'Error changing password' });
    }
};

export const completeOnboarding = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Not authorized' });
        const user = await User.findById(req.user._id);
        if (user) {
            user.isOnboardingComplete = true;
            await user.save();
            (res as any).status(200).json({ success: true });
        } else {
            (res as any).status(404).json({ message: "User not found" });
        }
    } catch (e) {
        (res as any).status(500).json({ message: 'Update failed' });
    }
};

// --- NEW PERSONA UPLOADS & SETTINGS ---
// --- DATA DONATION ---
export const toggleDataDonation = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { isDataDonationOn } = (req as any).body;

        const user = await User.findById(req.user._id);
        if (!user) return (res as any).status(404).json({ message: 'User not found' });

        user.isDataDonationOn = isDataDonationOn;
        await user.save();

        // RETROACTIVE DONATION
        if (isDataDonationOn && !user.hasDonatedHistory) {
            console.log(`[Data Donation] Starting retroactive export for ${user.name}`);
            // Run in background
            (async () => {
                try {
                    // Stream messages oldest → newest and pair user→assistant turns (no full-history load).
                    const cursor = await iterateAllMessages(user._id as any);
                    let prev: any = null;
                    let batch: any[] = [];
                    let exported = 0;
                    const isUndecryptable = (raw: string, dec: string) => raw.includes(':') && dec === raw;

                    for await (const msg of cursor as any) {
                        if (prev && prev.role === 'user' && msg.role === 'assistant') {
                            const inputDec = decrypt(prev.content);
                            const outputDec = decrypt(msg.content);
                            if (!isUndecryptable(prev.content, inputDec) && !isUndecryptable(msg.content, outputDec)) {
                                batch.push({
                                    insertOne: {
                                        document: {
                                            userMood: user.moodStatus || "neutral",
                                            persona: user.persona || "aastha",
                                            input: sanitizeForTraining(inputDec, user.name),
                                            output: sanitizeForTraining(outputDec, user.name),
                                            createdAt: msg.timestamp
                                        }
                                    }
                                });
                            }
                        }
                        prev = msg;
                        if (batch.length >= 500) {
                            await TrainingLog.bulkWrite(batch);
                            exported += batch.length;
                            batch = [];
                        }
                    }
                    if (batch.length > 0) {
                        await TrainingLog.bulkWrite(batch);
                        exported += batch.length;
                    }
                    if (exported > 0) console.log(`[Data Donation] Exported ${exported} pairs for ${user._id}`);

                    user.hasDonatedHistory = true;
                    await user.save();
                } catch (e) {
                    console.error("[Data Donation] Retroactive export failed:", e);
                }
            })();
        }

        (res as any).json({ success: true, message: 'Preference updated.', isDataDonationOn: user.isDataDonationOn });
    } catch(e) { (res as any).status(500).json({ message: 'Update failed' }); }
};
