import cron from 'node-cron';
import User from '../models/User';
import Diary from '../models/Diary';
import { sendGhostEmail } from './emailService';
import { generateGhostEmailContent } from './geminiService';
import { decrypt } from '../utils/serverEncryption';
import { isWebPushConfigured, sendToUser } from './webPush';
import { runReachOutSweep } from './reachOut';
import { runLetterSweep } from './weeklyLetter';
import dotenv from 'dotenv';
// import { sendPushNotification } from './notificationService'; // Placeholder for Firebase

dotenv.config();

// ✅ THIS EXPORT IS REQUIRED FOR APP.TS TO WORK
export const init = () => {
    console.log('[GhostService] Initialized. Watching for inactive souls...');

    // 7.4 follow-up check-ins (web push). Caps/quiet hours/crisis cooldown live in reachOut.ts.
    cron.schedule('*/15 * * * *', () => {
        runReachOutSweep().then(n => { if (n) console.log(`[ReachOut] sent ${n} check-in(s)`); }).catch(e => console.error('[ReachOut] sweep failed:', e?.message || e));
    });

    // Weekly letters: hourly, due from Sunday 18:00 on each user's clock (services/weeklyLetter.ts)
    cron.schedule('5 * * * *', () => {
        runLetterSweep().then(n => { if (n) console.log(`[Letter] wrote ${n} weekly letter(s)`); }).catch(e => console.error('[Letter] sweep failed:', e?.message || e));
    });

    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        const canEmail = !!process.env.RESEND_API_KEY;
        const canPush = isWebPushConfigured();
        if (!canEmail && !canPush) return; // nothing to send with

        try {
            console.log('[GhostService] Running check...');

            const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            // Find users who haven't visited in 24h AND haven't been ghosted yet
            // UPDATED: Catch legacy users who don't have the 'ghostNotificationSent' field at all
            const inactiveUsers = await User.find({
                lastVisit: { $lt: threshold },
                $or: [
                    { ghostNotificationSent: false },
                    { ghostNotificationSent: { $exists: false } }
                ],
                isVerified: true
            }).limit(50); // Process in batches to avoid rate limits

            for (const user of inactiveUsers) {
                try {
                    let email = user.email;
                    if (!email && user.emailEncrypted) {
                        try {
                            email = decrypt(user.emailEncrypted);
                        } catch (e) {
                            console.error(`[GhostService] Failed to decrypt email for user ${user._id}`);
                        }
                    }

                    if (!email) {
                        console.warn(`[GhostService] Skipping user ${user._id}: No valid email found.`);
                        continue;
                    }

                    console.log(`[GhostService] Ghosting user: ${user._id} (${email})`);

                    // 1. Get Keywords from latest diary entry
                    const latestEntry = await Diary.findOne({ user: user._id }).sort({ createdAt: -1 });
                    const keywords = latestEntry && latestEntry.moodKeywords ? decrypt(latestEntry.moodKeywords) : "life"; // legacy plaintext decrypts as-is

                    // 2. Prepare Rich Context from User Memory
                    const context = {
                        name: user.name.split(' ')[0], // First name only
                        keywords: keywords,
                        facts: (user.facts || []).map((f: string) => decrypt(f)),
                        lore: (user.lore || [])
                            .filter(l => l.isUnlocked) // Only use unlocked lore
                            .sort((a, b) => b.mentionCount - a.mentionCount) // Prioritize most mentioned
                            .slice(0, 3)
                            .map(l => decrypt(l.topic)),
                        openLoop: user.openLoops && user.openLoops.length > 0
                            ? decrypt(user.openLoops.filter(l => l.status === 'pending')[0]?.event || '') || undefined
                            : undefined,
                        persona: (user.persona || 'aastha') as any
                    };

                    // 3. Generate Unique Content via Gemini
                    const emailBody = await generateGhostEmailContent(context);

                    // 4. Send Email
                    // @ts-ignore: TS thinks persona is only 'aastha' because of default but it can be 'aarav'/'aastik'
                    const senderName = (user.persona === 'aarav' || user.persona === 'aastik') ? 'Aastik' : 'Aastha';
                    // Web Push first (instant, on their phone/browser), email as well if configured
                    const pushed = canPush
                        ? await sendToUser(user._id.toString(), { title: senderName, body: emailBody, tag: 'aastha-checkin' })
                        : 0;
                    const emailed = canEmail ? await sendGhostEmail(email, user.name, emailBody, senderName) : false;
                    const sent = pushed > 0 || emailed;

                    /*
                    // --- FUTURE FIREBASE INTEGRATION STUB ---
                    // This logic is ready for when FCM is set up.
                    if (user.fcmToken) {
                        await sendPushNotification(user.fcmToken, {
                            title: `Message from ${senderName}`,
                            body: "I've been thinking about what you said...",
                            data: { type: 'ghost_message', context: context }
                        });
                    }
                    */

                    if (sent) {
                        // 5. Update User State
                        user.ghostNotificationSent = true;
                        await user.save();
                    }

                    // Rate Limiting: Pause for 2 seconds between users to be gentle on APIs
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (userError) {
                    console.error(`[GhostService] Error processing user ${user._id}:`, userError);
                }
            }
        } catch (error) {
            console.error('[GhostService] Critical Cron Error:', error);
        }
    });
};
