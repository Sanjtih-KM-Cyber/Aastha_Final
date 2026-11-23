import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Created lazily: `new Razorpay()` throws without keys, which used to crash the WHOLE API at startup.
let razorpayClient: Razorpay | null = null;
const getRazorpay = (): Razorpay | null => {
  if (razorpayClient) return razorpayClient;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  razorpayClient = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  return razorpayClient;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// PLAN CATALOGUE — single source of truth for prices and durations.
// The plan a user receives is derived from the Razorpay ORDER (created by us),
// never from anything the client sends at verification time.
// ---------------------------------------------------------------------------
type PlanKey = 'pro' | 'voice';

const PLANS: Record<PlanKey, { orderNote: string; amountPaise: number; durationDays: number; label: string }> = {
  pro: { orderNote: 'early_bird_pro', amountPaise: 4900, durationDays: 30, label: 'Pro Access Activated' },
  voice: { orderNote: 'voice_topup', amountPaise: 1900, durationDays: 1, label: 'Voice Pass Activated' },
};

const planFromOrderNote = (note: unknown): PlanKey | null => {
  const match = (Object.keys(PLANS) as PlanKey[]).find((k) => PLANS[k].orderNote === note);
  return match || null;
};

const createOrderFor = async (req: AuthRequest, res: Response, plan: PlanKey) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

    const razorpay = getRazorpay();
    if (!razorpay) return (res as any).status(503).json({ message: 'Payments are temporarily unavailable.' });

    const { amountPaise, orderNote } = PLANS[plan];
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay receipt limit is 40 chars
      receipt: `${plan === 'voice' ? 'v_' : ''}rcpt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        plan: orderNote,
      },
    });

    if (!order) return (res as any).status(500).json({ message: 'Failed to create order' });

    (res as any).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // public key id only
    });
  } catch (error: any) {
    console.error(`Razorpay ${plan} order error:`, error);
    (res as any).status(500).json({ message: 'Payment initialization failed. Please try again.' });
  }
};

// POST /api/users/create-order  (Pro: ₹49 / 30 days)
export const createOrder = (req: AuthRequest, res: Response) => createOrderFor(req, res, 'pro');

// POST /api/users/create-voice-order  (Voice Pass: ₹19 / 1 day)
export const createVoiceOrder = (req: AuthRequest, res: Response) => createOrderFor(req, res, 'voice');

const safeEqualHex = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// POST /api/users/verify-payment
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return (res as any).status(401).json({ message: 'Unauthorized' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = (req as any).body || {};
    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      return (res as any).status(400).json({ success: false, message: 'Invalid payment details.' });
    }

    // 1. Signature proves this payment belongs to this order and came from Razorpay.
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqualHex(expectedSignature, razorpay_signature)) {
      return (res as any).status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    // 2. The order (created by us) decides WHO paid and WHAT they bought.
    const razorpay = getRazorpay();
    if (!razorpay) return (res as any).status(503).json({ success: false, message: 'Payments are temporarily unavailable.' });
    const order: any = await razorpay.orders.fetch(razorpay_order_id);
    const userId = req.user._id.toString();

    if (!order || order.notes?.userId !== userId) {
      console.warn(`[Payment] Order ${razorpay_order_id} does not belong to user ${userId}`);
      return (res as any).status(403).json({ success: false, message: 'This payment does not belong to your account.' });
    }

    const plan = planFromOrderNote(order.notes?.plan);
    if (!plan || Number(order.amount) !== PLANS[plan].amountPaise) {
      console.error(`[Payment] Order ${razorpay_order_id} has unknown plan/amount`, order.notes, order.amount);
      return (res as any).status(400).json({ success: false, message: 'Unrecognised plan.' });
    }

    // 3. Payment must be real and attached to this order.
    const payment: any = await razorpay.payments.fetch(razorpay_payment_id);
    if (!payment || payment.order_id !== razorpay_order_id || !['captured', 'authorized'].includes(payment.status)) {
      return (res as any).status(400).json({ success: false, message: 'Payment not completed.' });
    }

    // 4. Claim the payment atomically — a payment/order can only ever be redeemed once (any account).
    const alreadyUsed = await User.exists({
      $or: [{ 'paymentHistory.paymentId': razorpay_payment_id }, { 'paymentHistory.orderId': razorpay_order_id }],
    });
    if (alreadyUsed) {
      return (res as any).status(409).json({ success: false, message: 'This payment has already been applied.' });
    }

    const claimed = await User.findOneAndUpdate(
      { _id: req.user._id, 'paymentHistory.paymentId': { $ne: razorpay_payment_id } },
      {
        $push: {
          paymentHistory: {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: PLANS[plan].amountPaise,
            status: plan === 'voice' ? 'success_voice' : 'success',
            date: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!claimed) {
      return (res as any).status(409).json({ success: false, message: 'This payment has already been applied.' });
    }

    // 5. Grant / extend access (stacking on top of any time still remaining).
    const now = new Date();
    const extend = (current?: Date | null) => {
      const base = current && current > now ? new Date(current) : now;
      return new Date(base.getTime() + PLANS[plan].durationDays * DAY_MS);
    };

    if (plan === 'voice') {
      claimed.voiceTopUpExpires = extend(claimed.voiceTopUpExpires);
    } else {
      claimed.isPro = true;
      claimed.subscriptionDate = now;
      claimed.subscriptionExpiresAt = extend(claimed.subscriptionExpiresAt);
    }
    await claimed.save();

    (res as any).json({
      success: true,
      plan,
      message: PLANS[plan].label,
      expiresAt: plan === 'voice' ? claimed.voiceTopUpExpires : claimed.subscriptionExpiresAt,
    });
  } catch (error: any) {
    console.error('Payment Verification Error:', error);
    (res as any).status(500).json({ success: false, message: 'Verification failed. If you were charged, contact support.' });
  }
};
