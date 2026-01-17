import { Person } from '../models/Person';
import Groq from 'groq-sdk'; // Use Groq
import Chat from '../models/Chat';

// Reuse existing key logic or just pull from env
const getGroqClient = () => {
    const keys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').filter(k => k);
    const randomKey = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : '';
    if (!randomKey) throw new Error("No GROQ_API_KEYS found");
    return new Groq({ apiKey: randomKey });
};

export const detectiveService = {
    // 1. RETRO-SCAN: Analyze past chats to build the initial web
    runRetroactiveScan: async (userId: string) => {
        try {
            const chatHistory = await Chat.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

            let flatMessages: any[] = [];
            chatHistory.forEach(chat => {
                if (chat.messages) flatMessages = [...flatMessages, ...chat.messages];
            });
            // Sort by time descending (newest first) for context limit, then reverse for prompt
            flatMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const recentMessages = flatMessages.slice(0, 50);

            if (!recentMessages || recentMessages.length === 0) return { status: 'no_history' };

            const textLog = recentMessages.reverse().map((m: any) => `${m.role}: ${m.content}`).join('\n');

            const prompt = `
            You are a Social Detective. Analyze the following chat history.
            Identify specific PEOPLE the user mentions (friends, exes, family).
            Ignore public figures unless they are personally relevant.

            For each person, extract:
            - Name (Real name)
            - Alias (A funny or descriptive nickname based on their vibe, e.g. "The Flaker", "The Rock")
            - Relationship Score (-100 to 100). -100=Enemy, 0=Stranger, 100=Soulmate.
            - Verdict (KEEPER, TOXIC, SUSPECT, NPC)
            - Rap Sheet (List of 3 distinct behavioral traits or facts)

            Output STRICT JSON:
            {
              "people": [
                {
                  "name": "Bob",
                  "alias": "The Ghost",
                  "score": -20,
                  "verdict": "SUSPECT",
                  "rapSheet": ["Cancels plans", "Loves pizza", "Never texts first"]
                }
              ]
            }

            Chat Log:
            ${textLog}
            `;

            const client = getGroqClient();
            const completion = await client.chat.completions.create({
                messages: [{ role: 'system', content: prompt }],
                model: 'llama-3.1-70b-versatile', // Stronger model for analysis
                temperature: 0.1, // Deterministic
                response_format: { type: 'json_object' }
            });

            const responseText = completion.choices[0]?.message?.content || "{}";
            const parsed = JSON.parse(responseText);
            const people = parsed.people || [];

            // Upsert into DB
            let count = 0;
            for (const p of people) {
                if (!p.name) continue;
                await Person.findOneAndUpdate(
                    { userId, name: new RegExp(`^${p.name}$`, 'i') }, // Case insensitive match
                    {
                        userId,
                        name: p.name,
                        alias: p.alias,
                        relationshipScore: p.score,
                        verdict: p.verdict,
                        rapSheet: p.rapSheet,
                        lastUpdated: new Date()
                    },
                    { upsert: true, new: true }
                );
                count++;
            }

            return { status: 'success', count };

        } catch (error) {
            console.error("RetroScan Error:", error);
            return { status: 'error', error: String(error) };
        }
    },

    // 2. REAL-TIME UPDATE (Called by The Brain tool use)
    updateDossier: async (userId: string, updates: any) => {
        try {
            const { name, deltaScore, newTrait, verdict } = updates;
            if (!name) return { status: 'invalid_data' };

            const person = await Person.findOne({ userId, name: new RegExp(`^${name}$`, 'i') });

            if (person) {
                if (deltaScore) person.relationshipScore = Math.max(-100, Math.min(100, person.relationshipScore + deltaScore));
                if (verdict) person.verdict = verdict;
                if (newTrait && !person.rapSheet.includes(newTrait)) person.rapSheet.push(newTrait);

                // Keep rap sheet clean (max 5)
                if (person.rapSheet.length > 5) person.rapSheet.shift();

                await person.save();
                return { status: 'updated', person };
            } else {
                // Create new NPC
                const newPerson = await Person.create({
                    userId,
                    name,
                    alias: 'New Subject',
                    relationshipScore: deltaScore || 0,
                    verdict: verdict || 'NPC',
                    rapSheet: newTrait ? [newTrait] : []
                });
                return { status: 'created', person: newPerson };
            }
        } catch (error) {
            console.error("UpdateDossier Error:", error);
            return { status: 'error' };
        }
    },

    getWeb: async (userId: string) => {
        return await Person.find({ userId }).sort({ relationshipScore: -1 });
    }
};
