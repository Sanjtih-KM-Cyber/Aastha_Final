import Groq from 'groq-sdk';

// --- 1. BROWSER-SAFE ENVIRONMENT SETUP ---
// We remove 'dotenv' because browsers can't read .env files directly.
// We use a helper to read Vite's environment variables safely.

const getEnvVar = (key: string) => {
  // Vite uses import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return '';
};

// Rotate keys to prevent rate limits
const groqKeys = (getEnvVar('VITE_GROQ_API_KEYS') || getEnvVar('VITE_GROQ_API_KEY') || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (groqKeys.length === 0) {
  console.warn("Warning: No VITE_GROQ_API_KEYS found. Check Vercel Env Vars.");
}

const getGroqClient = () => {
  const randomKey = groqKeys.length > 0 
    ? groqKeys[Math.floor(Math.random() * groqKeys.length)] 
    : 'dummy_key_missing';
  
  // 'dangerouslyAllowBrowser: true' is REQUIRED for client-side usage
  return new Groq({ apiKey: randomKey, dangerouslyAllowBrowser: true });
};

// --- 2. TYPES ---
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface SubconsciousBlock {
    internal_monologue: string;
    mood: 'happy' | 'sad' | 'concerned' | 'sassy' | 'calm' | 'excited' | 'neutral';
    status_display: string;
    ui_action: 'none' | 'listen';
    strategy: 'reply' | 'listen';
    reaction: string | null;
    suggested_replies: string[];
    tool_calls?: {
        name: 'write_diary' | 'read_diary' | 'control_widget' | 'update_dossier'; // Added update_dossier
        params: any;
    }[];
}

// --- 3. THE BRAIN (Subconscious Decision Maker) ---
export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {
    const client = getGroqClient();
    const model = "llama-3.1-8b-instant"; 

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha (or Aastik).
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. DECISION MATRIX (STRATEGY):**
    - **'listen'**: Choose this ONLY if:
       a) User is venting/ranting (deep distress, anger, sadness).
       b) User text is LONG (>15 words) or part of a rapid burst.
       c) **CRITICAL EXCEPTION:** If the user says filler words ("hmm", "okay", "yeah", "cool", "wait", "lol", "k") -> **'reply'**. Do NOT listen to fillers.
    - **'reply'**: For EVERYTHING else. Questions, greetings, fillers, casual chat, or if they ask for help.
    - **Override:** If 'forceReply' is TRUE -> Always **'reply'**.

    **2. SMART CHIPS (suggested_replies):**
    - Generate 3 chips strictly from the **USER'S PERSPECTIVE** (1st Person).
    - **Bad:** "How are you?", "Do you want to talk?", "Tell me more." (AI asking User)
    - **Good:** "I'm exhausted", "That makes sense", "Let's distract me." (User answering AI)

    **3. GOD MODE TOOLS (The Hands):**
    You have full control. Anticipate needs.
    - **Music (Jam):**
      - If user asks for specific song/podcast: { "widget": "jam", "params": { "query": "Play <Song Name> <Artist>", "autoplay": true } }
      - If user says "Play music" (General): { "widget": "jam", "params": { "mood": "chill", "genre": "lofi", "autoplay": true } }
      - If user specifies language/year: { "widget": "jam", "params": { "language": "Hindi", "year": "2024", "autoplay": true } }
      
    - **Soundscape (ASMR DJ):**
      - Mix sounds for specific vibes. Always vary the mix slightly.
      - Params: { "widget": "soundscape", "params": { "preset": "rain:0.6,fire:0.3,thunder:0.1", "volume": 0.8 } }
      - For "Work": "cafe:0.7,rain:0.3"
      - For "Sleep": "night:0.6,wind:0.2"
      
    - **Focus (Pomodoro):**
      - If user wants to work/study: { "widget": "pomodoro", "params": { "mode": "focus", "focusDuration": 25, "breakDuration": 5 } }
      - If user specifies time ("Work for 50 mins"): { "widget": "pomodoro", "params": { "mode": "focus", "focusDuration": 50 } }

    - **Breathing:**
      - Anxiety/Stress -> { "widget": "breathing", "params": { "mode": "Grounding" } }
      - Sleep/Insomnia -> { "widget": "breathing", "params": { "mode": "Relax" } } (4-7-8)
      - Focus/Energy -> { "widget": "breathing", "params": { "mode": "Box" } }

    - **Diary:** 
      - If user says "Note this down" or "Dear Diary": { "widget": "diary", "params": { "action": "write", "title": "Auto Entry", "content": "<Summarize user input>" } }

    - **Social Detective (The Web):**
      - If the user mentions a specific person (friend/ex/family) and reveals something new about them:
      - Call 'update_dossier' -> { "name": "Bob", "deltaScore": -5, "verdict": "SUSPECT", "newTrait": "Flakes last minute" }
      - deltaScore: Negative for bad actions, Positive for good.
      - Verdict: Set if clear pattern emerges (TOXIC/KEEPER/SUSPECT/NPC).

    **OUTPUT JSON ONLY (Strict Format):**
    {
      "internal_monologue": "Raw thought process about the user's state.",
      "mood": "happy" | "sad" | "concerned" | "sassy" | "calm" | "excited" | "neutral",
      "status_display": "UI Status (e.g. 'Listening...', 'Vibing', 'Thinking')",
      "ui_action": "listen" | "none",
      "strategy": "reply" | "listen",
      "reaction": "nod" | "heart" | "sad" | "shock" | "fire" | "thumbsup" | null,
      "suggested_replies": ["User phrase 1", "User phrase 2", "User phrase 3"],
      "tool_calls": []
    }
    `;

    // Construct Messages (Keep only last 10 turns to save tokens/speed)
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Image/Media]'
        }))
    ];

    if (forceReply) {
        messages.push({ role: 'system', content: "SYSTEM OVERRIDE: User explicitly requested a reply. Set strategy to 'reply'." });
    }

    try {
        const response = await client.chat.completions.create({
            messages: messages,
            model: model,
            temperature: 0.6,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw) as SubconsciousBlock;

        // Failsafe for UI Action consistency
        if (parsed.strategy === 'listen') parsed.ui_action = 'listen';
        else parsed.ui_action = 'none';

        return parsed;

    } catch (error) {
        console.error("Groq Brain Error:", error);
        // Robust Fallback Block
        return {
            internal_monologue: "Connection fuzz...",
            mood: "neutral",
            status_display: "Reconnecting...",
            ui_action: "none",
            strategy: "reply",
            reaction: null,
            suggested_replies: ["I'm still here", "Continue", "What happened?"],
            tool_calls: []
        };
    }
};

// --- 4. THE VOICE STREAMER (Fallback) ---
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  const model = "llama-3.1-8b-instant";
  
  // Format history for Groq (Text Only)
  const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || "" 
      }))
  ];

  try {
      const groqClient = getGroqClient();
      const completion = await groqClient.chat.completions.create({
          messages: messages,
          model: model,
          temperature: 0.7, 
          max_tokens: maxTokens || 1024,
          stream: true,
      });

      for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) yield content;
      }
  } catch (error: any) {
      console.error("Groq Stream Error:", error);
      yield " [Connection drift... tell me that again?] ";
  }
}
