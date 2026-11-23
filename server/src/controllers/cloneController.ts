import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import { encrypt } from '../utils/serverEncryption';
import {
  validateConsent, buildConsentRecord, hasValidConsent, cloneDisplayName, analyzeScreenshot,
  encryptStyle, decryptStyle, isValidVoiceSample, ATTESTATION_TEXT, REQUIRED_ATTESTATIONS,
  CLONE_CONSENT_VERSION, CLONE_DAILY_LIMIT, MAX_SCREENSHOT_CHARS, validateChatSample, analyzeChatSample,
} from '../services/cloneService';

const status = (user: any) => {
  const cm = user.cloneMode || {};
  const style = decryptStyle(cm.styleNotes);
  return {
    consent: hasValidConsent(cm)
      ? { subject: cm.consent.subject, name: cloneDisplayName(cm), attestedAt: cm.consent.attestedAt }
      : null,
    hasStyle: !!style,
    style,                      // shown to the user so they can see exactly what was learned
    hasVoice: !!cm.voiceSample,
    isActive: !!cm.isActive && hasValidConsent(cm) && !!style,
    isVoiceActive: !!cm.isVoiceActive && !!cm.voiceSample,
    usedToday: cm.usageCount || 0,
    dailyLimit: CLONE_DAILY_LIMIT,
  };
};

const loadUser = (id: any, withVoice = false) =>
  User.findById(id).select(withVoice ? '+cloneMode.voiceSample' : '');

// GET /api/users/clone, status + the consent statements to show
export const getClone = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  (res as any).json({
    ...status(user),
    consentVersion: CLONE_CONSENT_VERSION,
    statements: {
      self: REQUIRED_ATTESTATIONS.self.map((k) => ({ key: k, text: ATTESTATION_TEXT[k] })),
      other: REQUIRED_ATTESTATIONS.other.map((k) => ({ key: k, text: ATTESTATION_TEXT[k] })),
    },
  });
};

// POST /api/users/clone/consent { subject, subjectName, attestations[] }
export const saveCloneConsent = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const body = (req as any).body || {};
  const error = validateConsent(body);
  if (error) return (res as any).status(400).json({ message: error });

  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });

  const prev: any = user.cloneMode?.consent;
  const record = buildConsentRecord(body, user.name);
  // Changing WHO is being imitated invalidates the previously learned style/voice.
  const subjectChanged = prev && (prev.subject !== record.subject || cloneDisplayName(user.cloneMode) !== cloneDisplayName({ consent: record }));
  (user as any).cloneMode = {
    ...((user.cloneMode as any)?.toObject?.() || user.cloneMode || {}),
    consent: record,
    ...(subjectChanged ? { styleNotes: '', voiceSample: undefined, isActive: false, isVoiceActive: false } : {}),
  };
  user.markModified('cloneMode');
  await user.save();
  (res as any).json(status(user));
};

// POST /api/users/persona-screenshot { image }, analysed then discarded; only style notes kept
export const uploadCloneScreenshot = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { image } = (req as any).body || {};
  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  if (!hasValidConsent(user.cloneMode)) return (res as any).status(403).json({ message: 'Please complete the consent step first.' });
  if (typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/i.test(image) || image.length > MAX_SCREENSHOT_CHARS) {
    return (res as any).status(400).json({ message: 'Please upload a PNG, JPEG or WebP screenshot under ~3 MB.' });
  }
  try {
    const notes = await analyzeScreenshot(image, (user.cloneMode as any).consent.subject);
    if (!notes.tone && !notes.phrases.length && !notes.quirks.length) {
      return (res as any).status(422).json({ message: "Couldn't read a texting style from that screenshot. Try one with more of their messages." });
    }
    (user.cloneMode as any).styleNotes = encryptStyle(notes);
    user.markModified('cloneMode');
    await user.save();
    (res as any).json(status(user));
  } catch (e: any) {
    console.error('[Clone] screenshot analysis failed:', e?.message);
    (res as any).status(503).json({ message: 'Analysis is busy right now, please try again in a minute.' });
  }
};

// POST /api/users/clone/chat-sample { messages: string[] }, from an exported chat, parsed + scrubbed on the device
export const uploadCloneChatSample = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  if (!hasValidConsent(user.cloneMode)) return (res as any).status(403).json({ message: 'Please complete the consent step first.' });
  const messages = validateChatSample((req as any).body?.messages);
  if (!messages) return (res as any).status(400).json({ message: 'Need at least 15 messages from that person to learn their style.' });
  try {
    const notes = await analyzeChatSample(messages);
    (user.cloneMode as any).styleNotes = encryptStyle(notes);
    user.markModified('cloneMode');
    await user.save();
    (res as any).json({ ...status(user), learnedFrom: messages.length });
  } catch (e: any) {
    console.error('[Clone] chat sample analysis failed:', e?.message);
    (res as any).status(503).json({ message: 'Analysis is busy right now, please try again in a minute.' });
  }
};

// POST /api/users/persona-voice { audio }, encrypted at rest
export const uploadCloneVoice = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { audio } = (req as any).body || {};
  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  if (!hasValidConsent(user.cloneMode)) return (res as any).status(403).json({ message: 'Please complete the consent step first.' });
  if (!isValidVoiceSample(audio)) return (res as any).status(400).json({ message: 'Please upload a clear audio clip (WAV/MP3/M4A/OGG/WebM) under ~3 MB.' });

  (user.cloneMode as any).voiceSample = encrypt(audio);
  (user.cloneMode as any).isVoiceActive = true;
  user.markModified('cloneMode');
  await user.save();
  (res as any).json(status(user));
};

// PUT /api/users/clone-settings { isActive?, isVoiceActive? }
export const updateCloneSettings = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  const { isActive, isVoiceActive } = (req as any).body || {};
  const user = await loadUser(req.user._id, true);
  if (!user) return (res as any).status(404).json({ message: 'User not found' });
  const cm: any = user.cloneMode || {};

  if (isActive === true && (!hasValidConsent(cm) || !decryptStyle(cm.styleNotes))) {
    return (res as any).status(403).json({ message: 'Complete consent and add a screenshot before turning Clone Mode on.' });
  }
  if (isVoiceActive === true && !cm.voiceSample) {
    return (res as any).status(400).json({ message: 'Upload a voice sample first.' });
  }
  if (isActive !== undefined) cm.isActive = !!isActive;
  if (isVoiceActive !== undefined) cm.isVoiceActive = !!isVoiceActive;
  cm.lastActive = new Date();
  user.markModified('cloneMode');
  await user.save();
  (res as any).json(status(user));
};

// DELETE /api/users/clone, wipes consent, style notes and voice sample
export const deleteClone = async (req: AuthRequest, res: Response) => {
  if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });
  await User.updateOne(
    { _id: req.user._id },
    {
      $set: { 'cloneMode.isActive': false, 'cloneMode.isVoiceActive': false, 'cloneMode.styleNotes': '', 'cloneMode.targetPersona': '' },
      $unset: { 'cloneMode.voiceSample': 1, 'cloneMode.consent': 1 },
    }
  );
  const user = await loadUser(req.user._id, true);
  (res as any).json(user ? status(user) : { consent: null, hasStyle: false, hasVoice: false, isActive: false });
};
