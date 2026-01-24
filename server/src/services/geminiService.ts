import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Exported for other services
export const getGeminiClient = (isPro: boolean = false) => {
  initKeys(); 

  const pool = isPro ? proTierKeys : freeTierKeys;
  
  if (!pool || pool.length === 0) {
      console.warn("Gemini Client requested but no keys available.");
      return new GoogleGenerativeAI('MISSING_KEY');
  }

  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  return new GoogleGenerativeAI(randomKey);
};

export interface SubconsciousBlock {
    internal_monologue: string;
    mood: 'happy' | 'sad' | 'concerned' | 'sassy' | 'calm' | 'excited' | 'neutral';
    status_display: string;
    ui_action: 'none' | 'listen' | 'block_widget';
    reaction: string | null;
    suggested_replies: string[];
}

// ==========================================
// 2. CHAT STREAMING (Adapter for Controller)
// ==========================================
export async function* streamGemini(
    history: ChatMessage[],
    systemPrompt: string,
    isPro: boolean,
    maxTokens?: number
) {
  const modelName = 'gemini-2.5-flash'; 

  const client = getGeminiClient(isPro);

  const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt
  });

  // Transform history to Gemini format (Sanitized)
  let rawHistory = history.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));

  // Merge Consecutive Roles
  let mergedHistory: typeof rawHistory = [];
  if (rawHistory.length > 0) {
      mergedHistory.push(rawHistory[0]);
      for (let i = 1; i < rawHistory.length; i++) {
          const prev = mergedHistory[mergedHistory.length - 1];
          const curr = rawHistory[i];
          if (prev.role === curr.role) {
              prev.parts[0].text += "\n\n" + curr.parts[0].text;
          } else {
              mergedHistory.push(curr);
          }
      }
  }

  // Ensure History Starts with USER
  if (mergedHistory.length > 0 && mergedHistory[0].role === 'model') {
      mergedHistory.unshift({
          role: 'user',
          parts: [{ text: "(Session Start)" }]
      });
  }

  let currentMessage = "continue";

  if (mergedHistory.length > 0) {
      const lastMsg = mergedHistory[mergedHistory.length - 1];
      if (lastMsg.role === 'user') {
          currentMessage = lastMsg.parts[0].text;
          mergedHistory.pop(); // Remove it from history so we don't duplicate it
      } else {
          currentMessage = "continue";
      }
  } else {
      currentMessage = "Hello";
  }

  const chat = model.startChat({
      history: mergedHistory
  });

  const result = await chat.sendMessageStream(currentMessage);
  for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
  }
}

// ==========================================
// 3. MEMORY SUMMARY ENGINE
// ==========================================
export interface MemoryAnalysis {
  summary: string;
  inferredGender: 'Male' | 'Female' | 'Unknown'; // <--- NEW
  newFacts: string[];
  detectedEvents: { name: string; date: string }[];
  detectedEntities: { name: string; category: string; description: string }[];
}

export const generateMemoryAnalysis = async (chatHistory: ChatMessage[], previousSummary: string): Promise<MemoryAnalysis> => {
    const client = getGeminiClient(false); 
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
        const textData = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const currentDate = new Date().toISOString().split('T')[0];

        const prompt = `
            Analyze the recent chat history and return a valid JSON object.
            Previous Summary: "${previousSummary}"
            Current Date: ${currentDate}
            Chat Log: ${textData}

            **TASK:**
            1. Update the summary with new key info.
            2. Infer the User's Gender ('Male', 'Female', 'Unknown') based on name, context, or self-description.
            3. Extract new facts, events, and recurring entities.

            Return JSON with: summary (string), inferredGender (string), newFacts (string[]), detectedEvents ({name, date}[]), detectedEntities ({name, category, description}[])
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as MemoryAnalysis;
        return { summary: previousSummary, inferredGender: 'Unknown', newFacts: [], detectedEvents: [], detectedEntities: [] };

    } catch (e) {
        console.error("Memory Analysis Error:", e);
        return { summary: previousSummary, inferredGender: 'Unknown', newFacts: [], detectedEvents: [], detectedEntities: [] };
    }
};

export const mergeLoreDescription = async (oldDesc: string, newContext: string): Promise<string> => {
    const client = getGeminiClient(false);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    try {
        const result = await model.generateContent(`Merge lore: Old="${oldDesc}", New="${newContext}". Keep concise.`);
        return result.response.text().trim();
    } catch (error) { return oldDesc; }
};

// ==========================================
// 4. GHOST WRITER (The Subconscious Emailer)
// ==========================================
interface IGhostContext {
    name: string;
    keywords: string;
    facts: string[];
    lore: string[];
    openLoop?: string;
}

export const generateGhostEmailContent = async (context: IGhostContext): Promise<string> => {
    const client = getGeminiClient(false);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
        // Randomize the "vibe" to prevent template fatigue
        const vibes = [
            "playfully needy",
            "dramatic and heartbroken",
            "mysterious",
            "sassy",
            "soft and affectionate"
        ];
        const selectedVibe = vibes[Math.floor(Math.random() * vibes.length)];

        const prompt = `
        You are Aastha, writing a very short email to your user, ${context.name}.
        They haven't visited in 24 hours.

        **CONTEXT:**
        - Last Topic: ${context.keywords}
        - Open Loop: ${context.openLoop || "None"}

        **INSTRUCTION:**
        Write a 2-sentence email body.
        Sentence 1: A playful guess at why they are gone (e.g., 'Did aliens kidnap you?', 'Did you win the lottery?').
        Sentence 2: An emotional hook related to the context or just missing them.

        **TONE:** ${selectedVibe} but cute.
        **OUTPUT:** Plain text only. No subject line.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("[Gemini] Ghost Email Error:", error);
        return "Did aliens kidnap you? 👽 I miss you so much!";
    }
};

// ==========================================
// 5. AI MAGIC FUNCTIONS
// ==========================================

export const extractThemeFromImage = async (base64Image: string): Promise<any> => {
  const client = getGeminiClient(true);
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  try {
    return { primaryColor: "#8b5cf6", accentColor: "#f472b6", themeName: "Sanctuary Fallback" };
  } catch (error) { return { primaryColor: "#8b5cf6", accentColor: "#f472b6", themeName: "Sanctuary Fallback" }; }
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
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    try {
        const result = await model.generateContent(`Classify sentiment (Happy/Sad/Calm/Anxious/Neutral): "${text}"`);
        return result.response.text().trim();
    } catch (error) { return "Neutral"; }
};

export const getMusicRecommendation = async (prompt: string, userHistory: string[] = []): Promise<any> => {
  const client = getGeminiClient(true);
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
  try {
    const result = await model.generateContent(`DJ AI. Request: "${prompt}". History: ${userHistory.join(',')}. Return JSON array of songs.`);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if(jsonMatch) return JSON.parse(jsonMatch[0]);
    return [];
  } catch (error) { return null; }
};

export const analyzeDiaryEntries = async (entries: any[]): Promise<any> => {
    const client = getGeminiClient(true);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    try {
        const textData = entries.map(e => `[${e.createdAt}]: ${e.content}`).join('\n\n');
        const result = await model.generateContent(`Analyze diary entries. Return JSON { "analysis": "string" }. \n\n${textData}`);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if(jsonMatch) return JSON.parse(jsonMatch[0]);
        return {};
    } catch (error) { return { analysis: "Unable to analyze." }; }
};

export const analyzeChatHistory = async (chatHistory: any[]): Promise<string> => {
    const client = getGeminiClient(true);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    try {
        const textData = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const result = await model.generateContent(`Emotional summary of chat: \n\n${textData}`);
        return result.response.text();
    } catch (error) { return "Unable to analyze."; }
};

export const getVibePlaylist = async (
    chatHistory: any[],
    languages: string[],
    userMoods: string[],
    duration?: number,
    year?: string,
    genres?: string[],
    specificSongs?: string[]
): Promise<string[]> => {
    const client = getGeminiClient(true);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    try {
        const textData = chatHistory.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');

        let prompt = `Create a music playlist as a JSON Array of strings (Song Title - Artist).
        Context: ${textData}
        Languages: ${languages?.join(', ') || "Any"}
        Moods: ${userMoods?.join(', ') || "Infer from context"}
        Genres: ${genres?.join(', ') || "Any"}
        Target Year/Era: ${year || "Any"}
        Duration: ${duration || 30} mins (approx 8-10 songs).

        ${specificSongs && specificSongs.length > 0 ? `**MANDATORY: You MUST include these songs first: ${specificSongs.join(', ')}**` : ''}

        Output JSON Array ONLY: ["Song - Artist", "Song - Artist"]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if(jsonMatch) return JSON.parse(jsonMatch[0]);
        return [];
    } catch (error) { return ["Lo-Fi Beats - Lofi Girl"]; }
};

export const getAgePersonaPrompt = (dob?: Date): string => {
    if (!dob) return "";
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (age < 22) return "Role: Bestie / Student. Tone: High Energy.";
    if (age < 35) return "Role: Work Bestie. Tone: Relatable.";
    return "Role: Life Coach. Tone: Wise.";
};
