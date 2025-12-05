import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Standard Gmail/SMTP Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or use host/port if not gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password if 2FA is on
  },
});

export const sendOTPEmail = async (to: string, otp: string) => {
  try {
    const mailOptions = {
      from: `"Aastha Sanctuary" <${process.env.EMAIL_USER}>`,
      to,
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
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
};
