import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789'); // Fallback prevents crash if key missing locally

export const sendOTPEmail = async (to: string, otp: string) => {
  // DEV: Log OTP immediately for debugging/fallback
  console.log(`[OTP-DEV] Generated OTP for ${to}: ${otp}`);

  if (!process.env.RESEND_API_KEY) {
      console.warn("[Email Service] No RESEND_API_KEY found. Email will NOT be sent. Use console log above.");
      return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Aastha <onboarding@resend.dev>', // Default Resend Testing Domain
      to: [to], // Resend Free Tier only sends to your own email unless you verify a domain
      subject: 'Your Verification Code - Aastha',
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
        console.error("Resend API Error:", error);
        return false;
    }

    console.log("OTP Email sent via Resend:", data?.id);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
};
