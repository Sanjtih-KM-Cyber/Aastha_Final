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
  verifySecurityAnswer,
  resetDiaryNuclear,
  changeDiaryPassword,
  updateProfile,
  upgradeToPro,
  verifyOTP,
  resendOTP,
  completeOnboarding,
  uploadPersonaVoice,
  uploadPersonaScreenshot,
  updateCloneSettings,
  toggleDataDonation,
  verifyResetOTP // ✅ Added import
} from '../controllers/authController';
import { createOrder, verifyPayment, createVoiceOrder } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

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
router.post('/upgrade', protect, upgradeToPro);

// Persona Uploads (New)
router.post('/persona-voice', protect, uploadPersonaVoice);
router.post('/persona-screenshot', protect, uploadPersonaScreenshot);
router.put('/clone-settings', protect, updateCloneSettings);
router.post('/toggle-data-donation', protect, toggleDataDonation);

// Account management
router.post('/delete-account', protect, softDeleteUser);
router.post('/reset-init', initiateReset);
router.post('/reset-verify-otp', verifyResetOTP); // ✅ Added route
router.post('/reset-complete', completeReset);

// Diary reset
router.post('/verify-security-answer', protect, verifySecurityAnswer);
router.post('/reset-diary-nuclear', protect, resetDiaryNuclear);
router.post('/change-diary-password', protect, changeDiaryPassword);
router.post('/complete-onboarding', protect, completeOnboarding);

export default router;
