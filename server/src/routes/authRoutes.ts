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
  updateProfile,
  upgradeToPro // Kept as fallback/mock
} from '../controllers/authController';
import { createOrder, verifyPayment } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/verify-diary', protect as any, verifyDiaryPassword as any);
router.get('/verify', protect as any, getMe as any);
router.get('/me', protect as any, getMe as any);
router.put('/profile', protect as any, updateProfile as any);

// Payment Routes
router.post('/create-order', protect as any, createOrder as any);
router.post('/verify-payment', protect as any, verifyPayment as any);
router.post('/upgrade', protect as any, upgradeToPro as any); // Fallback mock

router.post('/delete-account', protect as any, softDeleteUser as any);
router.post('/reset-init', initiateReset);
router.post('/reset-complete', completeReset);

// Diary Reset
router.post('/verify-security-answer', protect as any, verifySecurityAnswer as any);
router.post('/reset-diary-nuclear', protect as any, resetDiaryNuclear as any);

export default router;