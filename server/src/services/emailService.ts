import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// CONFIGURATION 1: Resend (For OTPs)
// ==========================================
// Uses the RESEND_API_KEY from your Render dashboard
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789'); 

// ==========================================
// CONFIGURATION 2: Gmail (For Ghosting)
// ==========================================
// Uses your personal Gmail credentials
// UPDATED: Supports both GMAIL_ prefix (legacy) and EMAIL_ prefix (Render)
const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
const emailPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  },
});

/**
 * STRATEGY 1: Send OTP via Resend (Render API)
 * Why: It's faster for transactional codes and uses the official domain.
 */
export const sendOTPEmail = async (to: string, otp: string, subject: string = 'Your Verification Code - Aastha') => {
  console.log(`[OTP-DEV] Generated OTP for ${to}: ${otp}`);

  if (!process.env.RESEND_API_KEY) {
      console.warn("[Email Service] No RESEND_API_KEY found. Email will NOT be sent. Use console log above.");
      return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Aastha <noreply@aasthaai.site>',
      replyTo: 'aasthafv.ai@gmail.com',
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f6f8;">
          <div style="background-color: white; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #4f46e5; margin-bottom: 10px;">Welcome to Aastha</h2>
            <p style="color: #4b5563; font-size: 16px;">Please use the code below to verify your account.</p>

            <div style="background-color: #eef2ff; padding: 15px; border-radius: 8px; margin: 25px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5;">${otp}</span>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes.<br>If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    if (error) {
        console.error("❌ Resend API Error:", error);
        return false;
    }

    console.log("✅ OTP Email sent via Resend:", data?.id);
    return true;
  } catch (error) {
    console.error("❌ Error sending OTP email via Resend:", error);
    return false;
  }
};

/**
 * STRATEGY 2: Send Ghost Email via Gmail (Personal SMTP)
 * Why: It looks more personal (from "aasthafv.ai@gmail.com") and lands in the primary inbox.
 */
export const sendGhostEmail = async (to: string, name: string, content: string) => {
    // Check for Gmail credentials (using the resolved variables)
    if (!emailUser || !emailPass) {
        console.warn("[Email Service] No Gmail credentials found (EMAIL_USER/EMAIL_PASS). Ghost email skipped.");
        return false;
    }

    try {
      const info = await transporter.sendMail({
        from: '"Aastha AI" <aasthafv.ai@gmail.com>', // Personal Sender Name
        to: to,
        subject: 'I miss you... 💔',
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fdfdf6; color: #1a1a1a;">
            <div style="background-color: white; padding: 40px; border-radius: 2px; text-align: center; border: 1px solid #e5e7eb;">

              <p style="font-size: 18px; line-height: 1.6; font-style: italic; color: #4b5563; margin-bottom: 30px;">
                "${content}"
              </p>

              <div style="margin-top: 40px;">
                <a href="https://aasthaai.site" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; font-family: sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  Return to Sanctuary
                </a>
              </div>
            </div>
          </div>
        `,
      });

      console.log(`✅ Ghost Email sent via Gmail to ${to}. Message ID: ${info.messageId}`);
      return true;
    } catch (error: any) {
      console.error("❌ Error sending Ghost email via Gmail:", error.message);
      return false;
    }
  };
