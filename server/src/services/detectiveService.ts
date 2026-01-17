import { Person } from '../models/Person';
import { GoogleGenerativeAI } from '@google/generative-ai'; // CORRECT PACKAGE
import Chat from '../models/Chat';

const getGenAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || '';
    return new GoogleGenerativeAI(apiKey);
};

export const detectiveService = {
    // 1. RETRO-SCAN
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
            [
              {
                "name": "Bob",
                "alias": "The Ghost",
                "score": -20,
                "verdict": "SUSPECT",
                "rapSheet": ["Cancels plans", "Loves pizza", "Never texts first"]
              }
            ]

            Chat Log:
            ${textLog}
            `;

            const genAI = getGenAIClient();
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return { status: 'failed_parse' };

            const people = JSON.parse(jsonMatch[0]);

            for (const p of people) {
                await Person.findOneAndUpdate(
                    { userId, name: p.name },
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
            }

            return { status: 'success', count: people.length };

        } catch (error) {
            console.error("RetroScan Error:", error);
            return { status: 'error', error };
        }
    },

    // 2. REAL-TIME UPDATE
    updateDossier: async (userId: string, updates: any) => {
        try {
            const { name, deltaScore, newTrait, verdict } = updates;
            const person = await Person.findOne({ userId, name: new RegExp(`^${name}$`, 'i') });

            if (person) {
                if (deltaScore) person.relationshipScore = Math.max(-100, Math.min(100, person.relationshipScore + deltaScore));
                if (verdict) person.verdict = verdict;
                if (newTrait) person.rapSheet.push(newTrait);
                if (person.rapSheet.length > 5) person.rapSheet.shift();

                await person.save();
                return { status: 'updated', person };
            } else {
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
