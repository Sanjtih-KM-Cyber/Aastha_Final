import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// CONFIGURATION: Resend (API-based Email)
// ==========================================
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789'); 

// ==========================================
// DESIGN — matches the app (Material You lavender on a deep surface). Email-safe: tables + inline styles only,
// no web fonts / CSS gradients (Gmail and Outlook strip them). Explicit colours so dark-mode clients don't invert it.
// ==========================================
const SITE = 'https://aasthaai.site';
const C = {
  page: '#0d0b14', card: '#17141f', cardEdge: '#2a2536', codeBg: '#241f33', codeEdge: '#3b3352',
  primary: '#c7bfff', text: '#ece7f6', muted: '#a49cb5', faint: '#6f6880',
};
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
export const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type OtpPurpose = 'verify' | 'login' | 'reset' | 'diary';
const OTP_COPY: Record<OtpPurpose, { subject: string; title: string; lead: string; why: string }> = {
  verify: { subject: 'your Aastha verification code', title: 'Welcome to your sanctuary', lead: 'Enter this code to confirm your email and finish setting up Aastha.', why: 'someone used this address to create or verify an Aastha account' },
  login:  { subject: 'your Aastha sign-in code', title: 'Confirm it’s you', lead: 'Enter this code to finish signing in.', why: 'someone tried to sign in to your Aastha account' },
  reset:  { subject: 'your Aastha password reset code', title: 'Reset your password', lead: 'Enter this code to choose a new password.', why: 'a password reset was requested for your account' },
  diary:  { subject: 'your Aastha diary reset code', title: 'Reset your diary password', lead: 'Enter this code to set a new diary password.', why: 'a diary password reset was requested' },
};

/** Branded shell shared by the emails: logo, card, footer. `preheader` = the grey preview line in the inbox list. */
const shell = (preheader: string, inner: string) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>Aastha</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
      <tr><td align="center" style="padding:0 0 22px;">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${SITE}/logo.png" width="52" height="52" alt="Aastha" style="display:block;border:0;border-radius:16px;margin:0 auto 10px;">
          <span style="font-family:${SERIF};font-size:22px;color:${C.text};letter-spacing:0.2px;">Aastha</span>
        </a>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.cardEdge};border-radius:28px;padding:36px 28px 32px;">
        ${inner}
      </td></tr>
      <tr><td align="center" style="padding:22px 12px 0;font-family:${SANS};">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${C.faint};">Aastha is an AI companion, not a therapist. In crisis, call Tele-MANAS <a href="tel:14416" style="color:${C.muted};">14416</a> (free, 24/7).</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${C.faint};">
          <a href="${SITE}/privacy" style="color:${C.muted};text-decoration:none;">Privacy</a> &nbsp;&middot;&nbsp;
          <a href="${SITE}/terms" style="color:${C.muted};text-decoration:none;">Terms</a> &nbsp;&middot;&nbsp; &copy; ${new Date().getFullYear()} Aastha
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

/** OTP email HTML (exported for previews/tests). One big monospace code: easy to read and long-press-copy as one. */
export const otpEmailHtml = (otp: string, purpose: OtpPurpose = 'verify') => {
  const copy = OTP_COPY[purpose] || OTP_COPY.verify;
  const code = String(otp).replace(/\D/g, '').slice(0, 6);
  return shell(`${code} is your Aastha code. It expires in 10 minutes.`, `
        <h1 style="margin:0 0 10px;font-family:${SERIF};font-weight:normal;font-size:26px;line-height:1.25;color:${C.text};text-align:center;">${esc(copy.title)}</h1>
        <p style="margin:0 0 26px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted};text-align:center;">${esc(copy.lead)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr><td style="background:${C.codeBg};border:1px solid ${C.codeEdge};border-radius:20px;padding:18px 22px 18px 32px;">
            <span style="display:block;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:36px;line-height:1;font-weight:700;letter-spacing:10px;color:${C.primary};text-align:center;white-space:nowrap;">${esc(code)}</span>
          </td></tr>
        </table>
        <p style="margin:14px 0 0;font-family:${SANS};font-size:13px;color:${C.faint};text-align:center;">Expires in 10 minutes &nbsp;&middot;&nbsp; Long-press the code to copy it</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
          <tr><td style="border-top:1px solid ${C.cardEdge};padding-top:20px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">
            <strong style="color:${C.text};">Didn’t ask for this?</strong> You got this email because ${esc(copy.why)}. If it wasn’t you, just ignore it &mdash; nobody can get in without this code. Never share it: Aastha will never ask you for it.
          </td></tr>
        </table>`);
};

const otpEmailText = (otp: string, purpose: OtpPurpose) => {
  const copy = OTP_COPY[purpose] || OTP_COPY.verify;
  return `${copy.title}\n\n${copy.lead}\n\nYour code: ${otp}\n(expires in 10 minutes)\n\nDidn't ask for this? You got this email because ${copy.why}. If it wasn't you, ignore it. Never share this code.\n\nAastha - ${SITE}\nIn crisis, call Tele-MANAS 14416 (free, 24/7).`;
};

/**
 * Send a one-time code. `purpose` picks the wording + subject (sign-up, sign-in, password reset, diary reset).
 * The subject starts with the code so it shows in the notification. Includes a plain-text part (deliverability).
 */
export const sendOTPEmail = async (to: string, otp: string, purpose: OtpPurpose = 'verify') => {
  // Never log codes/emails in production (Render logs are not a secret store)
  if (process.env.NODE_ENV !== 'production' && !process.env.RENDER) console.log(`[OTP-DEV] Generated OTP for ${to}: ${otp}`);

  if (!process.env.RESEND_API_KEY) {
      console.warn("[Email Service] No RESEND_API_KEY found. Email will NOT be sent. Use console log above.");
      return false;
  }

  try {
    const copy = OTP_COPY[purpose] || OTP_COPY.verify;
    const { data, error } = await resend.emails.send({
      from: 'Aastha <security@aasthaai.site>',
      replyTo: 'security@aasthaai.site',
      to: [to],
      subject: `${otp} is ${copy.subject}`,
      headers: { 'X-Entity-ID': 'Aastha-Security' },
      html: otpEmailHtml(otp, purpose),
      text: otpEmailText(otp, purpose),
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
 * STRATEGY 2: Send Ghost Email via Resend
 * Sender: Aastha/Aastik <me@aasthaai.site>
 * Subject: "Thinking of you..."
 * Headers: List-Unsubscribe, X-Entity-ID
 */
export const sendGhostEmail = async (to: string, name: string, content: string, senderName: string = "Aastha") => {
    if (!process.env.RESEND_API_KEY) {
        console.warn("[Email Service] No RESEND_API_KEY found. Ghost email skipped.");
        return false;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `${senderName} <me@aasthaai.site>`,
        replyTo: 'me@aasthaai.site',
        to: [to],
        subject: 'Thinking of you...',
        headers: {
            'List-Unsubscribe': '<mailto:unsubscribe@aasthaai.site>',
            'X-Entity-ID': 'Aastha-Ghost-Protocol'
        },
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
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #121620; border-radius: 16px; border: 1px solid #2d3748; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);">
                  <tr>
                    <td height="4" style="background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);"></td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px;">
                       <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #a78bfa; letter-spacing: 1px;">${esc(senderName)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px;">
                      <div style="font-size: 40px; color: #4b5563; margin-bottom: 10px; line-height: 1;">&ldquo;</div>
                      <p style="margin: 0 0 30px 0; color: #e5e7eb; font-size: 18px; line-height: 1.6; font-style: italic;">
                        ${esc(content)}
                      </p>
                      <a href="https://aasthaai.site" style="display: inline-block; background: linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);">
                        Return to Sanctuary
                      </a>
                    </td>
                  </tr>
                </table>
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
