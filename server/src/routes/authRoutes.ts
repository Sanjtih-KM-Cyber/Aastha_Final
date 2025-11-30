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
  upgradeToPro
} from '../controllers/authController';
import { createOrder, verifyPayment } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/logout', logoutUser);                // GET logout (matching frontend)
router.post('/verify-diary', protect, verifyDiaryPassword);
router.get('/verify', protect, getMe);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Payment / pro
router.post('/create-order', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.post('/upgrade', protect, upgradeToPro);

// Account management
router.post('/delete-account', protect, softDeleteUser);
router.post('/reset-init', initiateReset);
router.post('/reset-complete', completeReset);

// Diary reset
router.post('/verify-security-answer', protect, verifySecurityAnswer);
router.post('/reset-diary-nuclear', protect, resetDiaryNuclear);

export default router;
