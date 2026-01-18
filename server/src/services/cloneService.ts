import { getGeminiClient } from './geminiService';
import { ChatMessage } from './groqService';

// 1. ANALYZE SCREENSHOT (Extract Persona)
export const analyzeScreenshot = async (base64Image: string): Promise<string> => {
    try {
        const client = getGeminiClient(true);
        const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        Analyze this chat screenshot.
        Extract the personality of the "Other Person" (not the user).

        Output a SYSTEM PROMPT that forces an AI to roleplay as this person.
        Include:
        - Tone (e.g. Dry, Flirty, Angry, Passive Aggressive)
        - Slang/Vocabulary (Specific words they use)
        - Sentence Length (Short? Long paragraphs?)
        - Emoji Usage (Specific emojis)
        - Punctuation Style (No caps? All caps? Lots of ...?)

        Output ONLY the system prompt string. No JSON.
        Start with: "You are [Name/Role]..."
        `;

        // Strip prefix if present (e.g., "data:image/jpeg;base64,")
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

        const imagePart = {
            inlineData: {
                data: cleanBase64,
                mimeType: "image/jpeg"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();
        return text || "You are the person from the screenshot. Chill vibe.";
    } catch (error) {
        console.error("Screenshot Analysis Error:", error);
        return "You are a casual friend. Be chill.";
    }
};

// 2. GENERATE CLONE RESPONSE
export const generateCloneResponse = async (history: ChatMessage[], personaPrompt: string): Promise<string> => {
    try {
        const client = getGeminiClient(true);
        const model = client.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: personaPrompt
        });

        // Ensure history has valid text parts
        const safeHistory = history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
        }));

        const chat = model.startChat({
            history: safeHistory.slice(0, -1) // Exclude last message as it's the trigger
        });

        const lastMsg = history[history.length - 1];
        const content = typeof lastMsg.content === 'string' ? lastMsg.content : "Hey";

        const result = await chat.sendMessage(content);
        return result.response.text();
    } catch (error) {
        console.error("Clone Response Error:", error);
        return "lol idk what to say";
    }
};
