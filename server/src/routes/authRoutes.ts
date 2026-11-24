import express from 'express';
import { 
  registerUser, 
  loginUser, 
  logoutUser, 
  getMe, 
  verifyDiaryPassword,
  softDeleteUser,
  initiateReset,
  completeReset,
  verifyResetOTP,
  changeDiaryPassword,
  updateProfile,
  verifyOTP,
  resendOTP,
  completeOnboarding,
  toggleDataDonation
} from '../controllers/authController';
import { createOrder, verifyPayment, createVoiceOrder } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';
import { getDiaryResetOptions, sendDiaryResetCode, resetDiaryPassword, startFreshDiary } from '../controllers/diaryController';
import { getClone, saveCloneConsent, uploadCloneScreenshot, uploadCloneChatSample, uploadCloneVoice, updateCloneSettings, deleteClone } from '../controllers/cloneController';
import { getPushKey, subscribePush, unsubscribePush, testPush } from '../controllers/pushController';
import { getReachOut, updateReachOut, exportMyData, markSafetyIntroSeen, updatePreferences, acceptLegal, updateNickname, verifyAccountPassword, freshStart } from '../controllers/meController';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.get('/logout', logoutUser);                // GET logout (matching frontend)
router.post('/verify-diary', protect, verifyDiaryPassword);
router.post('/verify-diary-password', protect, verifyDiaryPassword); // Alias for clarity
router.get('/verify', protect, getMe);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Payment / pro
router.post('/create-order', protect, createOrder);
router.post('/create-voice-order', protect, createVoiceOrder);
router.post('/verify-payment', protect, verifyPayment);

// Web Push (browser / PWA), no Firebase needed
router.get('/push/key', getPushKey);
router.post('/push/subscribe', protect, subscribePush);
router.post('/push/unsubscribe', protect, unsubscribePush);
router.post('/push/test', protect, testPush);

// Persona Uploads (New)
// Clone Mode (consent-first; see services/cloneService.ts)
router.get('/clone', protect, getClone);
router.post('/clone/consent', protect, saveCloneConsent);
router.post('/persona-screenshot', protect, uploadCloneScreenshot);
router.post('/clone/chat-sample', protect, uploadCloneChatSample);
router.post('/persona-voice', protect, uploadCloneVoice);
router.put('/clone-settings', protect, updateCloneSettings);
router.delete('/clone', protect, deleteClone);
router.post('/toggle-data-donation', protect, toggleDataDonation);

// Phase 7: check-ins, export, safety intro
router.get('/reach-out', protect, getReachOut);
router.put('/reach-out', protect, updateReachOut);
router.get('/export', protect, exportMyData);
router.post('/safety-intro', protect, markSafetyIntroSeen);
router.put('/preferences', protect, updatePreferences);
router.put('/nickname', protect, updateNickname);
router.post('/verify-password', protect, verifyAccountPassword); // app-lock screen (rate-limited)
router.post('/fresh-start', protect, freshStart); // "Start fresh with Aastha": closeness / memories / chats
router.post('/legal-consent', protect, acceptLegal);

// Account management
router.post('/delete-account', protect, softDeleteUser);
router.post('/reset-init', initiateReset);
router.post('/reset-verify-otp', verifyResetOTP);
router.post('/reset-complete', completeReset);

// Diary reset
// Diary forgot-password (verified on the server; entries are kept unless the user chooses "start fresh")
router.get('/diary/reset-options', protect, getDiaryResetOptions);
router.post('/diary/reset-code', protect, sendDiaryResetCode);
router.post('/diary/reset-password', protect, resetDiaryPassword);
router.post('/diary/start-fresh', protect, startFreshDiary);
router.post('/change-diary-password', protect, changeDiaryPassword);
router.post('/complete-onboarding', protect, completeOnboarding);

export default router;
