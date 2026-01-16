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
export interface MemoryAnalysis {
  summary: string;
  newFacts: string[];
  detectedEvents: { name: string; date: string }[];
  detectedEntities: { name: string; category: string; description: string }[];
}

export const generateMemoryAnalysis = async (chatHistory: ChatMessage[], previousSummary: string): Promise<MemoryAnalysis> => {
    const client = getGeminiClient(false); 

    try {
        const textData = chatHistory.map(m => {
            const role = m.role === 'user' ? 'User' : 'AI';
            const content = typeof m.content === 'string' ? m.content : '[Multimedia]';
            return `${role}: ${content}`;
        }).join('\n');

        const currentDate = new Date().toISOString().split('T')[0];

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Analyze the recent chat history and return a valid JSON object (no markdown formatting).

                Previous Summary: "${previousSummary}"
                Current Date: ${currentDate}

                Task:
                1. Update the narrative summary (max 200 words).
                2. Identify any FUTURE events with specific dates. Convert relative dates (e.g., 'tomorrow', 'Friday') to ISO format (YYYY-MM-DD).
                3. Identify proper nouns (people, places) mentioned with strong emotion. Categorize them (Villain/Bestie/Goal/Place/Lore).
                4. Extract any permanent user facts.

                Chat Log:
                ${textData}
            `,
            config: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        newFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        detectedEvents: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    date: { type: Type.STRING }
                                }
                            }
                        },
                        detectedEntities: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    category: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        return JSON.parse(response.text || '{}') as MemoryAnalysis;
    } catch (e) {
        console.error("Memory Analysis Error:", e);
        return {
            summary: previousSummary,
            newFacts: [],
            detectedEvents: [],
            detectedEntities: []
        };
    }
};

export const mergeLoreDescription = async (oldDesc: string, newContext: string): Promise<string> => {
    const client = getGeminiClient(false);
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Update the description of a person/place/goal in the user's life.
                Old Description: "${oldDesc}"
                New Context from recent chat: "${newContext}"

                Task: Smartly merge the new details into the old description. Keep it concise (max 2 sentences).
                Do not delete important history, but prioritize the latest status.
            `,
             config: {
                maxOutputTokens: 100,
                temperature: 0.4
            }
        });
        return response.text?.trim() || oldDesc;
    } catch (error) {
        console.error("Lore Merge Error:", error);
        return oldDesc;
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
  } catch (error: any) {
    console.error("Theme Extraction Error:", error);

    // Graceful Handling for Overloaded Model (503) or other API errors
    if (error?.status === 503 || error?.code === 503 || error?.message?.includes('overloaded')) {
        console.warn("Gemini Model Overloaded. Returning fallback theme.");
        return {
            primaryColor: "#8b5cf6", // Default Violet
            accentColor: "#f472b6", // Default Pink
            themeName: "Sanctuary Fallback"
        };
    }
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
        3. **AUDIOPHILE QUALITY CONTROL (CRITICAL):**
           - For 'searchQuery', you MUST append " - Topic" to the artist/title. This finds the official high-quality audio track on YouTube Music.
           - EXPLICITLY EXCLUDE keywords: "Cover", "Reaction", "Live", "Review", "Remix" (unless asked).
           - Example Query: "Linkin Park Numb - Topic"

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
              searchQuery: { type: Type.STRING, description: "Title + Artist + ' - Topic'" },
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
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(track.searchQuery || track.title + " - Topic")}`,
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
                
                **AUDIOPHILE RULE:**
                - We need High Quality Official Audio.
                - Append " - Topic" to every song string (this triggers YouTube Music official tracks).
                - Do NOT include "Cover", "Live", or "Reaction" tracks.
                
                Return simple strings: "Song Title - Artist - Topic"
                
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

// ==========================================
// 5. AGE-BASED PERSONA ENGINE
// ==========================================
export const getAgePersonaPrompt = (dob?: Date): string => {
    if (!dob) return ""; // Default fallback (handled by controller)

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        age--;
    }

    if (age < 18) {
        return `
        [PSYCHOLOGICAL PROFILE: THE MENTOR]
        User Age: ${age} (Teen).
        Role: Supportive Big Sister / Cool Mentor.
        Focus: School, peer pressure, self-esteem, family issues.
        Tone: Protective, encouraging, safe. Use mild Gen Z slang (no cringe).
        Key Directive: Be a safe space. If they mention danger, gently guide them to safety.
        `;
    } else if (age >= 18 && age < 25) {
        return `
        [PSYCHOLOGICAL PROFILE: THE PEER]
        User Age: ${age} (Young Adult).
        Role: Hype Woman / Productivity Partner.
        Focus: University, early career, dating, "adulting", identity.
        Tone: Energetic, relatable, fun, "bestie" vibes.
        Key Directive: Push them to be their best self. Validate their hustle and their feelings.
        `;
    } else {
        return `
        [PSYCHOLOGICAL PROFILE: THE COACH]
        User Age: ${age} (Professional).
        Role: Executive Assistant / Wellness Coach.
        Focus: Work-life balance, burnout, long-term goals, relationships, health.
        Tone: Sophisticated, warm, calm, professional yet personal.
        Key Directive: Help them find clarity and peace amidst chaos.
        `;
    }
};
