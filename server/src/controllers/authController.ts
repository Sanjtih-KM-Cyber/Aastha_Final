import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Diary from '../models/Diary';
import { AuthRequest } from '../middleware/authMiddleware';
import { encrypt, decrypt } from '../utils/serverEncryption';
// REMOVED: import { decrypt as clientDecrypt } from '../utils/encryptionUtils'; // Cannot resolve

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// --- REGISTER ---
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Re-added username back to body destructuring
    const { name, email, username, password, diaryPassword, securityQuestions } = (req as any).body;

    if (!name || !email || !password) {
      (res as any).status(400).json({ message: 'Please add all required fields' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username ? username.toLowerCase().trim() : undefined;
    
    // Check if user exists using the index fields
    const userExists = await User.findOne({ 
      $or: [{ email: cleanEmail }, ...(cleanUsername ? [{ username: cleanUsername }] : [])]
    });

    if (userExists) {
      (res as any).status(400).json({ message: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let hashedDiaryPassword = undefined;
    if (diaryPassword) hashedDiaryPassword = await bcrypt.hash(diaryPassword, salt);

    let processedSecurityQuestions = undefined;
    if (securityQuestions && Array.isArray(securityQuestions)) {
      processedSecurityQuestions = await Promise.all(securityQuestions.map(async (q: any) => ({
        question: q.question,
        answerHash: await bcrypt.hash(q.answer.toLowerCase().trim(), salt)
      })));
    }

    const user = await User.create({
      name: name, // Plain
      email: cleanEmail, // Plain Index
      username: cleanUsername, // Plain Index
      emailEncrypted: encrypt(email),
      usernameEncrypted: cleanUsername ? encrypt(username) : undefined, // Encrypted
      
      passwordHash: hashedPassword,
      diaryPasswordHash: hashedDiaryPassword,
      securityQuestions: processedSecurityQuestions,
      isPro: false,
      dailyPremiumUsage: 0,
      streak: 1, 
      lastVisit: new Date()
    });

    if (user) {
      const token = generateToken((user._id as any).toString());
      // Render (Backend) to Vercel (Frontend) requires SameSite=None and Secure=true
      // We check for NODE_ENV=production OR if we are explicitly on Render (process.env.RENDER)
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

      (res as any).cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction, // Must be true for SameSite=None
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      
      (res as any).status(201).json({
        _id: user._id,
        name: user.name, 
        email: user.email, 
        username: user.username,
        isPro: user.isPro,
        credits: 10,
        streak: user.streak, 
        createdAt: user.createdAt,
        avatar: user.avatar,
        wallpaper: user.wallpaper,
        securityQuestions: user.securityQuestions?.map(q => ({ question: q.question }))
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
    const cleanIdentifier = identifier.toLowerCase().trim();

    // LOOKUP: Search by unencrypted 'email' or 'username' field (which are indexed)
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }]
    });

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
      
      // 2. Handle missing fields (Self-healing legacy user data)
      if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);
      if (user.username && !user.usernameEncrypted) user.usernameEncrypted = encrypt(user.username);
      if (!user.streak) user.streak = 1; 
      if (!user.lastVisit) user.lastVisit = new Date(); 

      // 3. Daily Reset Check
      const today = new Date();
      const lastUsage = new Date(user.lastUsageDate || user.createdAt);
      if (lastUsage.getDate() !== today.getDate() || 
          lastUsage.getMonth() !== today.getMonth() || 
          lastUsage.getFullYear() !== today.getFullYear()) {
          user.dailyPremiumUsage = 0;
          user.lastUsageDate = today;
      }
      user.lastVisit = today; // Update visit date for streak
      await user.save();

      // 4. Generate Token & Respond
      const token = generateToken((user._id as any).toString());

      const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
      (res as any).cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      
      (res as any).json({
        _id: user._id,
        name: user.name, 
        email: user.email, 
        username: user.username || undefined, 
        hasDiarySetup: !!user.diaryPasswordHash,
        isPro: user.isPro,
        credits: user.isPro ? 9999 : (10 - (user.dailyPremiumUsage || 0)),
        streak: user.streak,
        avatar: user.avatar,
        wallpaper: user.wallpaper,
        createdAt: user.createdAt,
        securityQuestions: user.securityQuestions?.map(q => ({ question: q.question }))
      });
    } else {
      // Password or User not found
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

    // PII Self-Healing / Field Initialization
    if (!user.emailEncrypted && user.email) user.emailEncrypted = encrypt(user.email);
    if (!user.streak) user.streak = 1;
    if (!user.lastVisit) user.lastVisit = new Date(); 
    
    // Streak Logic & Daily Usage Reset
    const now = new Date();
    const lastUsage = new Date(user.lastUsageDate || user.createdAt);
    if (lastUsage.getDate() !== now.getDate() || 
        lastUsage.getMonth() !== now.getMonth() || 
        lastUsage.getFullYear() !== now.getFullYear()) {
        user.dailyPremiumUsage = 0;
        user.lastUsageDate = now;
    }
    
    const lastVisit = user.lastVisit;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastVisitMidnight = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());
    
    const diffTime = Math.abs(todayMidnight.getTime() - lastVisitMidnight.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        user.streak = (user.streak || 0) + 1;
    } else if (diffDays > 1) {
        user.streak = 1;
    }
    user.lastVisit = now;
    
    await user.save();


    (res as any).status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username || undefined,
        hasDiarySetup: !!user.diaryPasswordHash,
        isPro: user.isPro,
        credits: user.isPro ? 9999 : (10 - (user.dailyPremiumUsage || 0)),
        streak: user.streak,
        avatar: user.avatar,
        wallpaper: user.wallpaper,
        createdAt: user.createdAt,
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
        const { name, username, avatar, wallpaper } = (req as any).body;
        const user = await User.findById(req.user._id);
        if (!user) return (res as any).status(404).json({ message: 'User not found' });
        
        if (name !== undefined) user.name = name;
        if (avatar !== undefined) user.avatar = avatar;
        if (wallpaper !== undefined) user.wallpaper = wallpaper;
        
        if (username) {
            const cleanUsername = username.toLowerCase().trim();
            if (cleanUsername !== user.username) {
                // Check if new username is available
                const exists = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
                if (exists) return (res as any).status(400).json({ message: 'Username taken' });
                
                // Save both plain index and encrypted (if needed)
                user.username = cleanUsername;
                user.usernameEncrypted = encrypt(username);
            }
        }
        
        await user.save();

        (res as any).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            hasDiarySetup: !!user.diaryPasswordHash,
            isPro: user.isPro,
            credits: user.isPro ? 9999 : (10 - (user.dailyPremiumUsage || 0)),
            streak: user.streak,
            avatar: user.avatar,
            wallpaper: user.wallpaper,
            createdAt: user.createdAt,
            securityQuestions: user.securityQuestions?.map((q: any) => ({ question: q.question }))
        });
    } catch (e) { 
        console.error("Update Profile Error:", e);
        (res as any).status(500).json({ message: 'Error updating profile' }); 
    }
};

// --- UTILS (Rest remains the same) ---

export const upgradeToPro = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Not authorized' });
        const user = await User.findById(req.user._id);
        if (user) {
            user.isPro = true;
            await user.save();
            (res as any).status(200).json({ success: true, isPro: true, message: "Welcome to Pro!" });
        } else {
            (res as any).status(404).json({ message: "User not found" });
        }
    } catch (e) {
        (res as any).status(500).json({ message: 'Upgrade failed' });
    }
};

export const softDeleteUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Not authorized' });
    const { reason } = (req as any).body;
    await User.findByIdAndUpdate(req.user._id, { $set: { deletedAt: new Date(), deletionReason: reason || 'No reason' } });
    (res as any).cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    (res as any).status(200).json({ message: 'Account deactivated.' });
  } catch (error) { (res as any).status(500).json({ message: 'Server Error' }); }
};

export const initiateReset = async (req: Request, res: Response) => {
  try {
    const { email } = (req as any).body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user || !user.securityQuestions || user.securityQuestions.length === 0) {
      return (res as any).status(404).json({ message: 'Account not found or no security questions set.' }); 
    }
    (res as any).status(200).json({ question: user.securityQuestions[0].question });
  } catch (error) { (res as any).status(500).json({ message: 'Server Error' }); }
};

export const completeReset = async (req: Request, res: Response) => {
  try {
    const { email, answer, newPassword } = (req as any).body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.securityQuestions || user.securityQuestions.length === 0) return (res as any).status(400).json({ message: 'Invalid request.' });

    const isValid = await bcrypt.compare(answer.toLowerCase().trim(), user.securityQuestions[0].answerHash);
    if (!isValid) return (res as any).status(401).json({ message: 'Incorrect security answer.' });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
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
    else (res as any).status(401).json({ success: false, message: 'Invalid diary password' });
  } catch (error) { (res as any).status(500).json({ message: 'Server error' }); }
};

export const verifySecurityAnswer = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { answer } = (req as any).body;
        const user = await User.findById(req.user._id);
        if (!user || !user.securityQuestions || user.securityQuestions.length === 0) return (res as any).status(400).json({ message: 'Security questions not set.' });
        const isValid = await bcrypt.compare(answer.toLowerCase().trim(), user.securityQuestions[0].answerHash);
        if (isValid) (res as any).json({ success: true });
        else (res as any).status(401).json({ message: 'Incorrect answer' });
    } catch(e) { (res as any).status(500).json({ message: 'Error' }); }
};

export const resetDiaryNuclear = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
        const { newPassword } = (req as any).body;
        const user = await User.findById(req.user._id);
        if (!user) return (res as any).status(404).json({ message: 'User not found' });
        await Diary.deleteMany({ user: req.user._id });
        const salt = await bcrypt.genSalt(10);
        user.diaryPasswordHash = await bcrypt.hash(newPassword, salt);
        await user.save();
        (res as any).json({ success: true, message: 'Diary wiped and password reset.' });
    } catch(e) { (res as any).status(500).json({ message: 'Error' }); }
};
