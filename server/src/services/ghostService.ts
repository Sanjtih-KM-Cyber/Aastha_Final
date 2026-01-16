import cron from 'node-cron';
import User from '../models/User';
import Diary from '../models/Diary';
import { sendGhostEmail } from './emailService';
import { GoogleGenAI } from '@google/genai';

const getGeminiClient = () => {
    // Reuse existing key logic or just pull from env
    const apiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(',')[0];
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const init = () => {
    console.log('[GhostService] Initialized. Watching for inactive souls...');

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('[GhostService] Running hourly check...');

            const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            // Find users who haven't visited in 24h AND haven't been ghosted yet
            const inactiveUsers = await User.find({
                lastVisit: { $lt: threshold },
                ghostNotificationSent: false,
                isVerified: true
            }).limit(50); // Process in batches to avoid rate limits

            for (const user of inactiveUsers) {
                try {
                    console.log(`[GhostService] Ghosting user: ${user._id} (${user.email})`);

                    // 1. Get Keywords from latest diary entry
                    const latestEntry = await Diary.findOne({ user: user._id }).sort({ createdAt: -1 });
                    const keywords = latestEntry && latestEntry.moodKeywords ? latestEntry.moodKeywords : "life";

                    // 2. Generate Guilt Trip Email Content via Gemini
                    const client = getGeminiClient();
                    let emailBody = `Is ${keywords} more important than us? 💔`; // Fallback

                    if (client) {
                        try {
                            const prompt = `You are Aastha. Your friend hasn't talked to you in 24 hours. They recently mentioned '${keywords}' in their diary. Write a 1-sentence, slightly jealous, and very clingy email asking why they are ignoring you. End with a heart emoji. Example: 'Is ${keywords} more important than our 24-hour streak? 💔'`;

                            const response = await client.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: prompt,
                            });

                            const text = response.text?.trim();
                            if (text) emailBody = text;
                        } catch (aiError) {
                            console.error(`[GhostService] AI Error for ${user._id}:`, aiError);
                        }
                    }

                    // 3. Send Email
                    const sent = await sendGhostEmail(user.email!, user.name, emailBody);

                    if (sent) {
                        // 4. Update User State
                        user.ghostNotificationSent = true;
                        user.moodStatus = 'mad';
                        await user.save();
                    }

                } catch (userError) {
                    console.error(`[GhostService] Error processing user ${user._id}:`, userError);
                }
            }
        } catch (error) {
            console.error('[GhostService] Critical Cron Error:', error);
        }
    });
};
