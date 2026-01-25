import cron from 'node-cron';
import User from '../models/User';
import Diary from '../models/Diary';
import { sendGhostEmail } from './emailService';
import { generateGhostEmailContent } from './geminiService';
import dotenv from 'dotenv';
// import { sendPushNotification } from './notificationService'; // Placeholder for Firebase

dotenv.config();

// ✅ THIS EXPORT IS REQUIRED FOR APP.TS TO WORK
export const init = () => {
    console.log('[GhostService] Initialized. Watching for inactive souls...');

    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        // Optimization: Fail fast if we can't send emails via Resend
        if (!process.env.RESEND_API_KEY) {
             console.warn("[GhostService] Skipping check: No RESEND_API_KEY found in environment.");
             return;
        }

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
                    console.log(`[GhostService] Ghosting user: ${user._id} (${user.email})`);

                    // 1. Get Keywords from latest diary entry
                    const latestEntry = await Diary.findOne({ user: user._id }).sort({ createdAt: -1 });
                    const keywords = latestEntry && latestEntry.moodKeywords ? latestEntry.moodKeywords : "life";

                    // 2. Prepare Rich Context from User Memory
                    const context = {
                        name: user.name.split(' ')[0], // First name only
                        keywords: keywords,
                        facts: user.facts || [],
                        lore: (user.lore || [])
                            .filter(l => l.isUnlocked) // Only use unlocked lore
                            .sort((a, b) => b.mentionCount - a.mentionCount) // Prioritize most mentioned
                            .slice(0, 3)
                            .map(l => l.topic),
                        openLoop: user.openLoops && user.openLoops.length > 0
                            ? user.openLoops.filter(l => l.status === 'pending')[0]?.event
                            : undefined,
                        persona: (user.persona || 'aastha') as any,
                        inferredGender: (user.inferredGender || 'Unknown') as any
                    };

                    // 3. Generate Unique Content via Gemini
                    const emailBody = await generateGhostEmailContent(context);

                    // 4. Send Email
                    // @ts-ignore: TS thinks persona is only 'aastha' because of default but it can be 'aarav'/'aastik'
                    const senderName = (user.persona === 'aarav' || user.persona === 'aastik') ? 'Aastik' : 'Aastha';
                    const sent = await sendGhostEmail(user.email!, user.name, emailBody, senderName);

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
                        user.moodStatus = 'mad';
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
