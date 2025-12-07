import { GoogleGenAI, Content, Part, Type } from '@google/genai';
import dotenv from 'dotenv';
import { ChatMessage } from './groqService';

dotenv.config();

// --- KEY ROTATION & SPLITTING ENGINE ---

// Lazy-load keys to avoid import-order race conditions
let freeTierKeys: string[] = [];
let proTierKeys: string[] = [];
let keysInitialized = false;

const initKeys = () => {
    if (keysInitialized) return;

    const allGeminiKeys = (process.env.GEMINI_API_KEYS || process.env.API_KEY || '')
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    const N = allGeminiKeys.length;

    if (N === 0) {
        console.error("FATAL ERROR: No GEMINI_API_KEYS found in environment variables. AI features will be unavailable.");
        keysInitialized = true;
        return;
    }

    // Allocate 60% of keys to the FREE pool initially
    const FREE_POOL_SHARE = 0.60;
    const FREE_POOL_SIZE = Math.ceil(N * FREE_POOL_SHARE);

    if (N >= 2) {
        freeTierKeys = allGeminiKeys.slice(0, FREE_POOL_SIZE);
        proTierKeys = allGeminiKeys.slice(FREE_POOL_SIZE);
        if (proTierKeys.length === 0) proTierKeys = allGeminiKeys;
    } else {
        freeTierKeys = allGeminiKeys;
        proTierKeys = allGeminiKeys;
    }

    console.log(`[AI SERVICE] Total Keys: ${N}. PRO Pool Size: ${proTierKeys.length} (40%). FREE Pool Size: ${freeTierKeys.length} (60%).`);
    keysInitialized = true;
};

const getGeminiClient = (isPro: boolean = false) => {
  initKeys(); // Ensure keys are loaded

  const pool = isPro ? proTierKeys : freeTierKeys;
  
  if (!pool || pool.length === 0) {
      console.warn("Gemini Client requested but no keys available.");
      return new GoogleGenAI({ apiKey: 'MISSING_API_KEY_HANDLED_GRACEFULLY' });
  }

  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  return new GoogleGenAI({ apiKey: randomKey });
};

// --- CHAT STREAMING (Logic remains the same) ---
export async function* streamGemini(history: ChatMessage[], systemPrompt: string, isPro: boolean) {
  const contents: Content[] = [];
  let hasImage = false;

  for (const msg of history) {
    if (msg.role === 'system') continue;
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: Part[] = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === 'text' && item.text) {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url' && item.image_url?.url) {
          hasImage = true;
          const matches = item.image_url.url.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
          }
        }
      }
    }
    if (parts.length > 0) contents.push({ role, parts });
  }

  // Use stable model
  const modelName = 'gemini-2.5-flash';
  
  try {
    const client = getGeminiClient(isPro);
    const response = await client.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  } catch (error: any) {
    console.error("Gemini Stream Error:", error?.message || error);
    yield " [Aastha is having trouble connecting to her premium senses. Please try again.]";
  }
}

// --- AI MAGIC FUNCTIONS (Uses Pro Client for reliability) ---

export const extractThemeFromImage = async (base64Image: string): Promise<any> => {
  const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image format");

  // Use Pro pool for reliability 
  const client = getGeminiClient(true); 
  
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: matches[1], data: matches[2] } },
          { text: "Extract the dominant primary color (Hex), a complementary accent color, and a creative name for this color palette based on the mood of the image." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryColor: { type: Type.STRING, description: "The dominant hex color" },
            accentColor: { type: Type.STRING, description: "A matching accent hex color" },
            themeName: { type: Type.STRING, description: "A creative name for the palette" }
          },
          required: ["primaryColor", "themeName"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Theme Extraction Error:", error);
    throw error;
  }
};

export const getMusicRecommendation = async (mood: string, userHistory: string[]): Promise<any> => {
  const client = getGeminiClient(true); // Priority feature
  
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Suggest 3 soothing songs for someone feeling "${mood}". 
                 History: ${userHistory.join(', ')}. 
                 Provide YouTube-searchable titles.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              artist: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Music Recommendation Error:", error);
    throw error;
  }
};

// --- 4. DIARY ANALYSIS (For Mood Tracker) ---
export const analyzeDiaryEntries = async (entries: any[]): Promise<any> => {
    const client = getGeminiClient(true);
    try {
        const textData = entries.map(e => `[${e.createdAt}]: ${e.content}`).join('\n\n');
        
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                You are an empathetic psychologist AI. Read these diary entries from the past week.
                
                Task:
                1. Identify the recurring emotional themes.
                2. Spot any triggers or wins.
                3. Write a warm, 3-4 sentence summary directly to the user about their week.
                4. End with a short, actionable piece of advice or affirmation.
                
                Diary Content:
                ${textData}
            `,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: { type: Type.STRING, description: "The warm summary and advice paragraph." }
                    }
                }
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Diary Analysis Error:", error);
        return { analysis: "Unable to analyze diary entries at this moment." };
    }
};

// --- 5. CHAT ANALYSIS (For Mood Tracker) ---
export const analyzeChatHistory = async (chatHistory: any[]): Promise<string> => {
    const client = getGeminiClient(true);
    try {
        const textData = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                You are an empathetic therapist AI. Analyze this recent chat history.
                Provide a warm, 2-sentence summary of how the user seems to be feeling lately.
                Then add one sentence of gentle advice.
                
                Chat History:
                ${textData}
            `
        });

        return response.text || "I need more conversations to understand you better.";
    } catch (error) {
        console.error("Chat Analysis Error:", error);
        return "Unable to analyze chat at the moment.";
    }
};

export const getVibePlaylist = async (chatHistory: any[], languages: string[], userMoods: string[], duration?: number): Promise<string[]> => {
    const client = getGeminiClient(true);
    try {
        const textData = chatHistory.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');
        const langString = languages.length > 0 ? languages.join(', ') : "English";
        const moodOverride = userMoods.length > 0 
            ? `The user explicitly feels: ${userMoods.join(', ')}. Prioritize this over the chat analysis.` 
            : "";
        
        // Calculate song count based on duration (approx 4 mins per song)
        // Default to 5 songs if no duration
        const targetCount = duration ? Math.ceil(duration / 4) : 5;
        // Cap it at reasonable limits to prevent context overflow or timeouts
        const safeCount = Math.min(Math.max(targetCount, 3), 50); // Increased cap to 50 for longer sessions
        
        const randomSeed = Math.floor(Math.random() * 10000); // Add randomness

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Analyze the recent chat history to understand the user's emotional state.
                ${moodOverride}
                
                Based on this vibe, create a unique and curated playlist of EXACTLY ${safeCount} distinct songs to last for ${duration || 20} minutes.
                Randomness Seed: ${randomSeed} (Use this to vary selections)
                
                RULES:
                1. Mix songs from these languages: ${langString}.
                2. Ensure the mood matches the user's state perfectly.
                3. You MUST provide ${safeCount} songs. Do not provide less.
                4. AVOID repeating the most generic top-chart songs. Dig deeper for hidden gems and varied artists.
                5. Return ONLY a JSON array of strings in "Song Title - Artist" format.
                
                Chat Context:
                ${textData}
            `,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING
                    }
                }
            }
        });

        const result = JSON.parse(response.text || '[]');
        if (Array.isArray(result)) return result.map(String);
        if ((result as any).songs) return (result as any).songs;
        return [];

    } catch (error: any) {
        console.error("Vibe Gen Error:", error.message || error);
        return ["Lo-Fi Beats - Lofi Girl"];
    }
};