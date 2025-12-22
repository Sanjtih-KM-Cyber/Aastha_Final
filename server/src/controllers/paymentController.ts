import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Create Order (POST /api/users/create-order)
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

    // FIX: Shortened receipt ID. 
    // "rcpt_" (5 chars) + Date (13 chars) = 18 chars. 
    // This is safe. The old version was ~46 chars (Limit is 40).
    const shortReceiptId = `rcpt_${Date.now()}`;

    // CRITICAL PRICING: ₹49.00
    const options = {
      amount: 4900, // paise (49 INR)
      currency: "INR",
      receipt: shortReceiptId, 
      notes: {
        userId: req.user._id.toString(),
        plan: "early_bird_pro"
      }
    };

    const order = await razorpay.orders.create(options);

    if (!order) return (res as any).status(500).json({ message: "Failed to create order" });

    (res as any).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID // Send public key to frontend
    });

  } catch (error: any) {
    console.error("Razorpay Order Error:", error);
    // Send the actual error description to frontend for easier debugging
    const errorMessage = error.error?.description || "Payment initialization failed";
    (res as any).status(500).json({ message: errorMessage });
  }
};

// Verify Payment (POST /api/users/verify-payment)
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = (req as any).body;

    // Verify Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Update User to PRO
      const user = await User.findById(req.user._id);
      if (user) {
        user.isPro = true;
        user.subscriptionDate = new Date();
        user.paymentHistory.push({
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: 4900,
          status: 'success',
          date: new Date()
        });
        await user.save();
        
        (res as any).json({ success: true, message: "Pro Access Activated" });
      } else {
        (res as any).status(404).json({ success: false, message: "User not found" });
      }
    } else {
      (res as any).status(400).json({ success: false, message: "Invalid Payment Signature" });
    }

  } catch (error: any) {
    console.error("Payment Verification Error:", error);
    (res as any).status(500).json({ success: false, message: "Verification failed" });
  }
};
