/**
 * Phase 7 "me" endpoints:
 *  - GET/PUT /api/users/reach-out     check-in switch + what the phone should schedule (7.4)
 *  - GET     /api/users/export        "Export my data" (7.5, DPDP Act right to access)
 *  - POST    /api/users/safety-intro  "How Aastha keeps you safe" card seen (7.5)
 *  - GET     /api/data/moods/insights weekly mood view + one honest insight (7.4)
 */
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Mood from '../models/Mood';
import Diary from '../models/Diary';
import { Person } from '../models/Person';
import { decrypt } from '../utils/serverEncryption';
import { iterateAllMessages } from '../services/messageStore';
import { upcomingCheckIns } from '../services/reachOut';
import { getMoodInsights } from '../services/moodInsights';
import { toPublicPerson } from '../services/detectiveService';
import { cleanTimeZone } from '../utils/timeZone';
import { currentConsent } from '../legal';
import { listCustomMoods, addCustomMood, deleteCustomMood } from '../services/customMoods';

/** ?tz=Area/City from the app → stored so check-ins follow the device clock (also after travel). */
const rememberTimeZone = async (userId: any, raw: unknown) => {
  const tz = cleanTimeZone(raw);
  if (tz) await User.updateOne({ _id: userId, timeZone: { $ne: tz } }, { $set: { timeZone: tz } });
  return tz;
};

export const getReachOut = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  await rememberTimeZone(req.user._id, (req as any).query?.tz);
  const u: any = await User.findById(req.user._id).select('name persona followUps reachOut timeZone').lean();
  if (!u) return (res as any).status(404).json({ message: 'Not found' });
  (res as any).json({
    enabled: u.reachOut?.enabled !== false,
    timeZone: u.timeZone || null,
    pending: (u.followUps || []).filter((f: any) => f.status === 'pending').length,
    upcoming: upcomingCheckIns(u),
  });
};

export const updateReachOut = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { enabled } = (req as any).body || {};
  if (typeof enabled !== 'boolean') return (res as any).status(400).json({ message: 'enabled must be true or false' });
  await User.updateOne({ _id: req.user._id }, { $set: { 'reachOut.enabled': enabled } });
  (res as any).json({ enabled });
};

export const markSafetyIntroSeen = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  await User.updateOne({ _id: req.user._id }, { $set: { safetyIntroSeenAt: new Date() } });
  (res as any).json({ ok: true });
};

export const moodInsights = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  try {
    const tz = (await rememberTimeZone(req.user._id, (req as any).query?.tz)) || (await User.findById(req.user._id).select('timeZone').lean() as any)?.timeZone;
    (res as any).json(await getMoodInsights(req.user._id, new Date(), tz));
  } catch (e) {
    console.error('Mood insights failed:', e);
    (res as any).status(500).json({ message: 'Could not load insights' });
  }
};

// Exports are heavy (whole history) → max 3 per user per hour (in-process; fine for one Render instance)
const exportLog = new Map<string, number[]>();
export const EXPORT_LIMIT_PER_HOUR = 3;

export const exportMyData = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const uid = String(req.user._id);
  const now = Date.now();
  const recent = (exportLog.get(uid) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= EXPORT_LIMIT_PER_HOUR) return (res as any).status(429).json({ message: 'You can export 3 times an hour. Please try again a bit later.' });
  exportLog.set(uid, [...recent, now]);

  try {
    const u: any = await User.findById(req.user._id).lean();
    if (!u) return (res as any).status(404).json({ message: 'Not found' });

    const chats: any[] = [];
    const cursor = await iterateAllMessages(req.user._id);
    for await (const m of cursor as any) {
      chats.push({
        timestamp: m.timestamp,
        role: m.role,
        content: decrypt(m.content || ''),
        ...(m.voice_note ? { voiceNote: m.voice_note } : {}),
        ...(m.isClone ? { aiImitation: true } : {}),
        ...(m.userReaction ? { yourReaction: m.userReaction } : {}),
        ...(m.gif?.url ? { gif: m.gif.url } : {}),
      });
    }
    const [moods, diary, people] = await Promise.all([
      Mood.find({ user: req.user._id }).sort({ timestamp: 1 }).lean(),
      Diary.find({ user: req.user._id }).sort({ entryDate: 1 }).lean(),
      Person.find({ userId: req.user._id }).lean().catch(() => [] as any[]),
    ]);
    const email = u.emailEncrypted ? decrypt(u.emailEncrypted) : u.email;

    (res as any).setHeader('Cache-Control', 'no-store');
    (res as any).json({
      format: 'aastha-export-v1',
      exportedAt: new Date().toISOString(),
      notice: 'Everything Aastha stores about you. Diary entries are locked with your device key; the app unlocks them before saving this file. Voice-note links work for 30 days after recording.',
      profile: {
        name: decrypt(u.name || ''), username: u.username, email, dateOfBirth: u.dateOfBirth ? new Date(decrypt(String(u.dateOfBirth))).toISOString().slice(0, 10) : null, persona: u.persona, createdAt: u.createdAt,
        avatar: u.avatar ? decrypt(u.avatar) : null, wallpaper: u.wallpaper ? decrypt(u.wallpaper) : null,
        preferredLanguage: u.preferredLanguage, region: u.region ? decrypt(u.region) : '', closenessLevel: u.bond?.level ?? 0,
        plan: { pro: !!u.isPro, proUntil: u.subscriptionExpiresAt || null, voicePassUntil: u.voiceTopUpExpires || null },
        payments: (u.paymentHistory || []).map((p: any) => ({ date: p.date, amountPaise: p.amount, status: p.status, paymentId: p.paymentId })),
        legalConsent: u.legalConsent || null,
        settings: { gifs: u.gifsEnabled !== false, checkIns: u.reachOut?.enabled !== false, dataDonation: !!u.isDataDonationOn, windowControls: u.windowControls || 'windows', appFont: u.appFont || 'jakarta', headingFont: u.headingFont || 'fraunces', themeColor: u.themeColor || null },
        customMoods: (u.customMoods || []).map((m: any) => ({ label: decrypt(m.label || ''), emoji: m.emoji, level: m.score })),
      },
      memory: {
        summary: decrypt(u.memorySummary || ''),
        facts: (u.facts || []).map((f: string) => decrypt(f)).filter(Boolean),
        followUps: (u.followUps || []).map((f: any) => ({ about: decrypt(f.text || ''), date: f.dueDate, status: f.status })),
        texting: u.styleProfile || null,
      },
      moods: moods.map((m: any) => ({ date: m.timestamp, mood: decrypt(m.mood || ''), score: m.score })),
      diary: diary.map((d: any) => ({
        date: d.entryDate, title: d.title, content: d.content, tags: d.tags,
        keywords: d.moodKeywords ? decrypt(d.moodKeywords) : undefined,
        locked: true, // client replaces with decrypted text when the diary key is available
      })),
      people: (people as any[]).map((p) => { try { const x: any = toPublicPerson(p); return { name: x.name, alias: x.alias, verdict: x.verdict, notes: x.rapSheet, closeness: x.relationshipScore }; } catch { return null; } }).filter(Boolean),
      cloneMode: u.cloneMode?.consent ? {
        person: u.cloneMode.consent.subject === 'self' ? 'You' : (u.cloneMode.consent.subjectName ? decrypt(u.cloneMode.consent.subjectName) : 'Someone else'),
        consentedAt: u.cloneMode.consent.attestedAt, active: !!u.cloneMode.isActive,
        styleNotes: u.cloneMode.styleNotes ? decrypt(u.cloneMode.styleNotes) : null,
      } : null,
      chats,
    });
  } catch (e) {
    console.error('Export failed:', e);
    (res as any).status(500).json({ message: 'Export failed. Please try again.' });
  }
};


// --- Custom mood types: GET/POST /api/data/moods/custom, DELETE /api/data/moods/custom/:id ---
export const getCustomMoods = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  (res as any).json(await listCustomMoods(req.user._id));
};
export const createCustomMood = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const r = await addCustomMood(req.user._id, (req as any).body);
  (res as any).status(r.status).json(r.mood || { message: r.error });
};
export const removeCustomMood = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const ok = await deleteCustomMood(req.user._id, String((req as any).params?.id || ''));
  (res as any).status(ok ? 200 : 404).json({ ok });
};

// --- Preferences that follow the user across phone + web ---
/** Font ids — keep in sync with client/src/design/fonts.ts */
export const APP_FONTS = ['jakarta', 'inter', 'nunito', 'quicksand', 'outfit', 'dmsans', 'lexend', 'atkinson', 'lora', 'system'];
export const HEADING_FONTS = ['fraunces', 'playfair', 'lora', 'same'];
/** Sanctuary colour: a preset (client ThemeContext) or any #rrggbb from the colour wheel. */
export const THEME_PRESETS = ['lotus', 'aurora', 'sunset', 'ocean', 'midnight'];
export const cleanThemeColor = (v: unknown): string | null => {
  const s = String(v ?? '').trim().toLowerCase();
  return THEME_PRESETS.includes(s) || /^#[0-9a-f]{6}$/.test(s) ? s : null;
};
export const updatePreferences = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { windowControls, appFont, headingFont, themeColor } = (req as any).body || {};
  const set: any = {};
  if (themeColor !== undefined) {
    const c = cleanThemeColor(themeColor);
    if (!c) return (res as any).status(400).json({ message: 'themeColor must be a preset or #rrggbb' });
    set.themeColor = c;
  }
  if (appFont !== undefined) {
    if (!APP_FONTS.includes(appFont)) return (res as any).status(400).json({ message: 'Unknown font' });
    set.appFont = appFont;
  }
  if (headingFont !== undefined) {
    if (!HEADING_FONTS.includes(headingFont)) return (res as any).status(400).json({ message: 'Unknown heading font' });
    set.headingFont = headingFont;
  }
  if (windowControls !== undefined) {
    if (windowControls !== 'mac' && windowControls !== 'windows') return (res as any).status(400).json({ message: 'windowControls must be "mac" or "windows"' });
    set.windowControls = windowControls;
  }
  if (!Object.keys(set).length) return (res as any).status(400).json({ message: 'Nothing to update' });
  await User.updateOne({ _id: req.user._id }, { $set: set });
  (res as any).json(set);
};


// PUT /api/users/nickname — { action: 'set', value } | { action: 'regenerate' } | { action: 'off' } | { action: 'on' }
export const updateNickname = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { action, value } = (req as any).body || {};
  const user: any = await User.findById(req.user._id);
  if (!user) return (res as any).status(404).json({ message: 'Not found' });
  const cur = user.nickname || {};
  const { makeNickname } = await import('../services/companionExtras');
  const { effectiveLevel } = await import('../services/relationship');
  if (action === 'set') {
    const v = String(value || '').replace(/\s+/g, ' ').trim();
    if (!/^[\p{L}\p{M}][\p{L}\p{M} '’.-]{1,19}$/u.test(v) || v.split(' ').length > 3) return (res as any).status(400).json({ message: 'Use 2–20 letters (up to 3 words).' });
    user.nickname = { value: v, by: 'user', setAt: new Date(), announced: true, off: false };
  } else if (action === 'regenerate') {
    if (effectiveLevel(user.bond) < 4) return (res as any).status(400).json({ message: 'Nicknames unlock at Bestie.' });
    const nick = await makeNickname({ name: user.name, facts: (user.facts || []).map((f: string) => decrypt(f)), persona: user.persona === 'aarav' || user.persona === 'aastik' ? 'aastik' : 'aastha', avoid: cur.value ? [cur.value] : [] });
    if (!nick) return (res as any).status(503).json({ message: 'Couldn’t think of one right now — try again in a moment.' });
    user.nickname = { value: nick, by: 'aastha', setAt: new Date(), announced: true, off: false };
  } else if (action === 'off' || action === 'on') {
    user.set('nickname.off', action === 'off');
  } else {
    return (res as any).status(400).json({ message: 'Unknown action' });
  }
  user.markModified('nickname');
  await user.save();
  const n = user.nickname || {};
  (res as any).json({ nickname: { value: n.value || '', by: n.by || 'aastha', off: !!n.off } });
};

// POST /api/users/verify-password { password } — unlocks the app-lock screen with the account password.
// Already signed in (protect), so it only confirms it's still you. 5 wrong tries → 15 min cool-down per account.
const unlockFails = new Map<string, { n: number; until: number }>();
export const _resetUnlockLimiter = () => unlockFails.clear();
export const verifyAccountPassword = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const id = String(req.user._id);
  const f = unlockFails.get(id);
  if (f && f.until > Date.now()) return (res as any).status(429).json({ message: 'Too many tries. Please wait a few minutes.' });
  const password = String((req as any).body?.password || '');
  const u: any = await User.findById(id).select('+passwordHash');
  const ok = !!u?.passwordHash && password.length > 0 && password.length <= 200 && await bcrypt.compare(password, u.passwordHash);
  if (!ok) {
    const n = (f && f.until <= Date.now() && f.n >= 5 ? 0 : f?.n || 0) + 1;
    unlockFails.set(id, { n, until: n >= 5 ? Date.now() + 15 * 60_000 : 0 });
    // 422, not 401: the app treats 401/403 as "session expired" and signs you out — a typo must not do that
    return (res as any).status(422).json({ message: 'Wrong password' });
  }
  unlockFails.delete(id);
  (res as any).json({ ok: true });
};

// POST /api/users/legal-consent { accept: true } — records acceptance of the current Terms + Privacy Policy
export const acceptLegal = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  if ((req as any).body?.accept !== true) return (res as any).status(400).json({ message: 'accept must be true' });
  const consent = currentConsent();
  await User.updateOne({ _id: req.user._id }, { $set: { legalConsent: consent } });
  (res as any).json({ ok: true, ...consent });
};
