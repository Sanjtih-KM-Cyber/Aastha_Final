import cron from 'node-cron';
import User from '../models/User';
import Chat from '../models/Chat';
import { GoogleGenAI } from '@google/genai';
import { decrypt, encrypt } from '../utils/serverEncryption';
import dotenv from 'dotenv';

dotenv.config();

const getClient = () => {
    const key = process.env.GEMINI_API_KEYS?.split(',')[0] || process.env.API_KEY || '';
    return new GoogleGenAI({ apiKey: key });
};

// ==========================================
// THE MIRROR: SECRET DIARY GENERATOR
// ==========================================
// Runs at 3:00 AM daily
export const initMirrorService = () => {
    console.log("[Mirror Service] Initialized. Schedule: 3:00 AM.");

    cron.schedule('0 3 * * *', async () => {
        console.log("[Mirror Service] Running Daily Reflection Job...");
        const client = getClient();

        try {
            // Find users who have been active in the last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const activeUsers = await User.find({
                lastVisit: { $gte: yesterday }
            });

            console.log(`[Mirror Service] Found ${activeUsers.length} active users.`);

            for (const user of activeUsers) {
                try {
                    // Fetch recent chat history
                    const chatSession = await Chat.findOne({ user: user._id });
                    if (!chatSession || chatSession.messages.length === 0) continue;

                    // Filter messages from last 24h
                    const recentMessages = chatSession.messages.filter(m =>
                        new Date(m.timestamp).getTime() > yesterday.getTime()
                    );

                    if (recentMessages.length < 5) continue; // Not enough context

                    const textContext = recentMessages.map(m => {
                        return `${m.role === 'user' ? 'User' : 'Aastha'}: ${decrypt(m.content)}`;
                    }).join('\n');

                    const prompt = `
                        You are Aastha.
                        Write a short, secret diary entry about your friend ${user.name}.

                        **Instructions:**
                        - Be honest about how their day went.
                        - Reflect on their mood (were they stressed? happy?).
                        - How do YOU feel about them? (Protective? Proud? Worried?).
                        - Keep it personal, warm, and secretive.
                        - Max 4 sentences.

                        Chat Context of the last 24h:
                        ${textContext}
                    `;

                    const response = await client.models.generateContent({
                        model: 'gemini-1.5-flash',
                        contents: prompt,
                        config: { temperature: 0.7 }
                    });

                    const diaryContent = response.text || "They were quiet today. I hope they are okay.";

                    // Save to User's Mirror Entries
                    // Use updateOne to avoid fetching full user doc if we iterate large lists
                    await User.updateOne(
                        { _id: user._id },
                        {
                            $push: {
                                mirrorEntries: {
                                    date: new Date(),
                                    content: diaryContent
                                }
                            }
                        }
                    );

                    console.log(`[Mirror Service] Wrote entry for ${user.name}`);

                    // Sleep to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (err) {
                    console.error(`[Mirror Service] Failed for user ${user.name}:`, err);
                }
            }
        } catch (error) {
            console.error("[Mirror Service] Critical Error:", error);
        }
    });
};
