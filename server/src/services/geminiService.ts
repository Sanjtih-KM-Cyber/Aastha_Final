import { GoogleGenAI, Content, Part, Type } from '@google/genai';
import dotenv from 'dotenv';
import { ChatMessage } from './groqService';

dotenv.config();

// ==========================================
// 1. KEY ROTATION & SPLITTING ENGINE
// ==========================================

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
        console.error("FATAL ERROR: No GEMINI_API_KEYS found. AI features will be unavailable.");
        keysInitialized = true;
        return;
    }

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

    console.log(`[AI SERVICE] Total Keys: ${N}. PRO Pool: ${proTierKeys.length}. FREE Pool: ${freeTierKeys.length}.`);
    keysInitialized = true;
};

const getGeminiClient = (isPro: boolean = false) => {
  initKeys(); 

  const pool = isPro ? proTierKeys : freeTierKeys;
  
  if (!pool || pool.length === 0) {
      console.warn("Gemini Client requested but no keys available.");
      return new GoogleGenAI({ apiKey: 'MISSING_KEY' });
  }

  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  return new GoogleGenAI({ apiKey: randomKey });
};

// ==========================================
// 2. CHAT STREAMING (Adapter for Controller)
// ==========================================
export async function* streamGemini(
    history: ChatMessage[],
    systemPrompt: string,
    isPro: boolean,
    maxTokens?: number
) {
  const contents: Content[] = [];

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
          const matches = item.image_url.url.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
          }
        }
      }
    }
    if (parts.length > 0) contents.push({ role, parts });
  }

  const modelName = 'gemini-2.5-flash';
  
  try {
    const client = getGeminiClient(isPro);
    const response = await client.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.85, // FIX: Increased creativity to avoid repetition
        maxOutputTokens: maxTokens,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  } catch (error: any) {
    console.error("Gemini Stream Error:", error?.message || error);
    yield " [Aastha is taking a moment to reconnect. Please try again.]";
  }
}

// ==========================================
// 3. MEMORY SUMMARY ENGINE
// ==========================================
export const generateSummary = async (chatHistory: ChatMessage[], previousSummary: string): Promise<string> => {
    const client = getGeminiClient(false); 

    try {
        const textData = chatHistory.map(m => {
            const role = m.role === 'user' ? 'User' : 'AI';
            const content = typeof m.content === 'string' ? m.content : '[Multimedia]';
            return `${role}: ${content}`;
        }).join('\n');

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Read this chat conversation and update the "Memory Summary".
                Previous Summary: "${previousSummary}"
                Task: Identify new facts (names, goals), patterns, and communication style. Merge with previous summary (max 200 words).
                Chat Log: ${textData}
            `,
            config: { maxOutputTokens: 300, temperature: 0.3 }
        });

        return response.text?.trim() || previousSummary;
    } catch (e) {
        console.error("Memory Summary Error:", e);
        return previousSummary;
    }
};

// ==========================================
// 4. AI MAGIC FUNCTIONS
// ==========================================

export const extractThemeFromImage = async (base64Image: string): Promise<any> => {
  const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image format");

  const client = getGeminiClient(true); 
  
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: matches[1], data: matches[2] } },
          { text: "Extract the dominant primary color (Hex), a complementary accent color, and a creative name for this color palette." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            themeName: { type: Type.STRING }
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

export const extractColorsFromImage = async (base64Image: string, mimeType: string): Promise<string[] | null> => {
    try {
        const result = await extractThemeFromImage(base64Image);
        return [result.primaryColor, result.accentColor, "#FFFFFF", "#000000", result.primaryColor]; 
    } catch {
        return null;
    }
};

export const analyzeSentiment = async (text: string): Promise<string> => {
    const client = getGeminiClient(false);
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Classify sentiment: Happy, Calm, Sad, Anxious, Neutral, Excited. Text: "${text}"`,
        });
        return response.text?.trim() || "Neutral";
    } catch (error) {
        return "Neutral";
    }
};

export const getMusicRecommendation = async (prompt: string, userHistory: string[] = []): Promise<any> => {
  const client = getGeminiClient(true);
  
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        You are an expert DJ AI.
        User Request: "${prompt}"
        User History: ${userHistory.join(', ')}

        **INSTRUCTIONS:**
        1. **Search Mode:** If the user asks for a SPECIFIC song (e.g., "Play Faint by Linkin Park"), return ONLY that song.
        2. **Recommendation Mode:** If the user asks for a mood/suggestion (e.g., "I'm sad", "Play something pop"), return 3 distinct songs.
        3. **QUALITY CONTROL (CRITICAL):** - You MUST append "Official Video" or "Official Audio" to the song title for the YouTube search query.
           - This ensures we get proper music channels, NOT shorts or fan uploads.

        Output JSON format.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Song Title - Artist" },
              artist: { type: Type.STRING },
              searchQuery: { type: Type.STRING, description: "Title + Artist + 'Official Video'" },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    });

    const results = JSON.parse(response.text || '[]');
    
    if (results.length > 0) {
       return results.map((track: any) => ({
          name: track.title,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(track.searchQuery || track.title + " Official Video")}`,
          ...track
       }));
    }
    return null;

  } catch (error) {
    console.error("Music Recommendation Error:", error);
    return null;
  }
};

export const analyzeDiaryEntries = async (entries: any[]): Promise<any> => {
    const client = getGeminiClient(true);
    try {
        const textData = entries.map(e => `[${e.createdAt}]: ${e.content}`).join('\n\n');
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze these diary entries. Write a warm, empathetic 3-4 sentence summary and 1 piece of actionable advice.\n\n${textData}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { analysis: { type: Type.STRING } }
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Diary Analysis Error:", error);
        return { analysis: "Unable to analyze right now." };
    }
};

export const analyzeChatHistory = async (chatHistory: any[]): Promise<string> => {
    const client = getGeminiClient(true);
    try {
        const textData = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this chat history. Provide a warm 2-sentence emotional summary and 1 sentence of gentle advice.\n\n${textData}`
        });
        return response.text || "I need more conversations to understand you better.";
    } catch (error) {
        return "Unable to analyze chat at the moment.";
    }
};

export const getVibePlaylist = async (chatHistory: any[], languages: string[], userMoods: string[], duration?: number): Promise<string[]> => {
    const client = getGeminiClient(true);
    try {
        const textData = chatHistory.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');
        const count = duration ? Math.ceil(duration / 4) : 5;
        const safeCount = Math.min(Math.max(count, 3), 30);

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Create a curated playlist of exactly ${safeCount} songs based on this chat context.
                Languages: ${languages.join(',') || 'English'}.
                Mood: ${userMoods.join(',')}.
                
                **CRITICAL RULE:** Only select songs that have "Official Music Videos" or "Official Audio" on YouTube. Avoid obscure tracks that only have low-quality uploads.
                
                Return simple strings: "Song Title - Artist"
                
                Context:
                ${textData}
            `,
            config: { 
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        const result = JSON.parse(response.text || '[]');
        return Array.isArray(result) ? result : [];
    } catch (error) {
        return ["Lo-Fi Beats - Lofi Girl"];
    }
};
