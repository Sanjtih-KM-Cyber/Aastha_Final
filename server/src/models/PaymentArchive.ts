import mongoose from 'mongoose';

/**
 * Minimal payment records kept AFTER an account is deleted, because Indian tax/accounting law requires
 * transaction records to be retained (Income-tax Rule 6F, CGST Act s.36, Privacy Policy §8).
 * No name, no email, no chats, only the transaction facts plus the hash of the email (so a refund/dispute
 * request from that email can be matched). Auto-deleted after 8 years.
 */
const paymentArchiveSchema = new mongoose.Schema({
  emailHash: { type: String, index: true },
  records: [{ orderId: String, paymentId: String, amount: Number, status: String, date: Date, _id: false }],
  deletedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 * 8 },
});

export const PaymentArchive = mongoose.model('PaymentArchive', paymentArchiveSchema);
