import express from 'express';
import { registerUser, loginUser, logoutUser, getMe, verifyOTP, resendOTP } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOTP); // New
router.post('/resend-otp', resendOTP); // New
router.post('/logout', logoutUser);
router.get('/me', protect as any, getMe as any);

export default router;