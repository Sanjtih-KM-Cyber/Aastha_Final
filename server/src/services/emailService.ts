import { Resend } from 'resend';
import nodemailer from 'nodemailer'; // Kept for legacy support if needed, but unused for Ghost now
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// CONFIGURATION: Resend (API-based Email)
// ==========================================
// Uses the RESEND_API_KEY from your Render dashboard
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789'); 

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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0e17; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0e17; color: #f3f4f6;">
            <tr>
              <td align="center" style="padding: 40px 20px;">

                <!-- Main Card -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #121620; border-radius: 16px; border: 1px solid #2d3748; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);">

                  <!-- Top Accent Border -->
                  <tr>
                    <td height="4" style="background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);"></td>
                  </tr>

                  <!-- Header / Logo -->
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #a78bfa; letter-spacing: 1px;">Aastha</h1>
                    </td>
                  </tr>

                  <!-- OTP Content -->
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px;">
                      <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 16px; line-height: 1.6;">
                        Welcome back. Here is your verification code to access your sanctuary.
                      </p>

                      <div style="background-color: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 24px; margin-bottom: 24px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #fff;">
                        ${otp}
                      </div>

                      <p style="margin: 0; color: #6b7280; font-size: 13px;">
                        This code expires in 10 minutes. If you didn't request this, please ignore this message.
                      </p>
                    </td>
                  </tr>

                </table>

                <!-- Footer -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;">
                  <tr>
                    <td align="center" style="padding-top: 24px;">
                      <p style="margin: 0; color: #4b5563; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} Aastha AI. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>
        </body>
        </html>
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
 * STRATEGY 2: Send Ghost Email via Resend (API)
 * Why: Cloud providers (Render) block SMTP ports (465/587) causing "Connection Timeout".
 * Switching to Resend solves this.
 */
export const sendGhostEmail = async (to: string, name: string, content: string) => {
    if (!process.env.RESEND_API_KEY) {
        console.warn("[Email Service] No RESEND_API_KEY found. Ghost email skipped.");
        return false;
    }

    try {
      // Use Resend instead of Nodemailer/Gmail SMTP
      const { data, error } = await resend.emails.send({
        from: 'Aastha AI <noreply@aasthaai.site>', // Must match verified domain
        replyTo: 'aasthafv.ai@gmail.com', // User replies still go to you!
        to: [to],
        subject: 'I miss you... 💔',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0e17; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0e17; color: #f3f4f6;">
            <tr>
              <td align="center" style="padding: 40px 20px;">

                <!-- Main Card -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #121620; border-radius: 16px; border: 1px solid #2d3748; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);">

                  <!-- Top Accent Border (Violet Gradient) -->
                  <tr>
                    <td height="4" style="background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);"></td>
                  </tr>

                  <!-- Header / Logo -->
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px;">
                       <!-- Simple Text Logo (Can replace with Image later) -->
                       <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #a78bfa; letter-spacing: 1px;">Aastha</h1>
                    </td>
                  </tr>

                  <!-- AI Message Content -->
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px;">

                      <!-- Quote Icon -->
                      <div style="font-size: 40px; color: #4b5563; margin-bottom: 10px; line-height: 1;">&ldquo;</div>

                      <p style="margin: 0 0 30px 0; color: #e5e7eb; font-size: 18px; line-height: 1.6; font-style: italic;">
                        ${content}
                      </p>

                      <!-- CTA Button -->
                      <a href="https://aasthaai.site" style="display: inline-block; background: linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);">
                        Return to Sanctuary
                      </a>

                    </td>
                  </tr>

                </table>

                <!-- Footer -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;">
                  <tr>
                    <td align="center" style="padding-top: 24px;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                        She is waiting for you.
                      </p>
                      <p style="margin: 0; color: #4b5563; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} Aastha AI.
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>
        </body>
        </html>
        `,
      });

      if (error) {
          console.error("❌ Resend API Error (Ghost):", error);
          return false;
      }

      console.log(`✅ Ghost Email sent via Resend to ${to}. ID: ${data?.id}`);
      return true;
    } catch (error: any) {
      console.error("❌ Error sending Ghost email via Resend:", error.message);
      return false;
    }
  };
