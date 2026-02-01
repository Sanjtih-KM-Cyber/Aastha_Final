import Groq from 'groq-sdk';

// --- 1. BROWSER-SAFE ENVIRONMENT SETUP ---
const getEnvVar = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return '';
};

const groqKeys = (getEnvVar('VITE_GROQ_API_KEYS') || getEnvVar('VITE_GROQ_API_KEY') || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (groqKeys.length === 0) {
  console.warn("Warning: No VITE_GROQ_API_KEYS found. Check Vercel Env Vars.");
}

// Helper: Get a specific Groq client by index
const getGroqClient = (index: number) => {
  const key = groqKeys.length > 0
    ? groqKeys[index % groqKeys.length]
    : 'dummy_key_missing';
  
  return new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
};

// --- 2. TYPES ---
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface SubconsciousBlock {
    internal_monologue: string;
    mood: 'happy' | 'sad' | 'concerned' | 'sassy' | 'calm' | 'excited' | 'neutral' | 'angry';
    status_display: string;
    ui_action: 'none' | 'listen';
    strategy: 'reply' | 'listen';
    reaction: string | null;
    suggested_replies: string[];
    tool_calls?: {
        name: 'write_diary' | 'read_diary' | 'control_widget' | 'update_dossier' | 'change_theme';
        params: any;
    }[];
}

// ============================================================================
// 2026 GOLDEN STACK ARCHITECTURE (Ported from Server)
// ============================================================================
const MODEL_CONFIG = {
    soul: {
        primary: 'qwen/qwen3-32b',
        fallback: 'meta-llama/llama-4-maverick-17b-128e-instruct'
    },
    brain: {
        primary: 'llama-3.1-8b-instant',
        fallback: 'meta-llama/llama-4-scout-17b-16e-instruct'
    },
    hands: {
        primary: 'groq/compound',
        fallback: 'llama-3.3-70b-versatile'
    },
    subconscious: {
        primary: 'openai/gpt-oss-20b',
        fallback: 'llama-3.1-8b-instant'
    }
};

type ModelCategory = keyof typeof MODEL_CONFIG;

// ============================================================================
// SAFE EXECUTION HELPERS
// ============================================================================

/**
 * Attempts to run a chat completion using the Primary model, failing over to Fallback.
 */
const safeChatCompletion = async (
    category: ModelCategory,
    messages: any[],
    temperature: number = 0.6,
    maxTokens: number = 500,
    jsonMode: boolean = false
): Promise<any> => {
    const config = MODEL_CONFIG[category];
    const modelsToTry = [config.primary, config.fallback];

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];

        // Load Balance Keys
        const start = Math.floor(Math.random() * groqKeys.length);

        // Try up to 3 keys per model before switching models
        for (let k = 0; k < Math.min(3, groqKeys.length); k++) {
            const keyIndex = (start + k) % groqKeys.length;
            try {
                const client = getGroqClient(keyIndex);

                const completion = await client.chat.completions.create({
                    messages: messages,
                    model: model,
                    temperature: temperature,
                    max_tokens: maxTokens,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                });

                return completion.choices[0]?.message?.content || "";

            } catch (error: any) {
                const isNotFound = error?.status === 404;
                console.warn(`[Groq Client] Failed ${model} (Key ${keyIndex}): ${error?.message || error}`);

                // If 404 (Model not found), break key loop immediately and try next model
                if (isNotFound) break;
            }
        }
        console.warn(`[Groq Client] Dropping model ${model} for ${category}...`);
    }

    throw new Error(`All models failed for category: ${category}`);
};

/**
 * Attempts to stream a chat completion using Primary -> Fallback strategy.
 */
async function* safeStreamCompletion(
    category: ModelCategory,
    messages: any[],
    temperature: number = 0.7,
    maxTokens: number = 1024
) {
    const config = MODEL_CONFIG[category];
    const modelsToTry = [config.primary, config.fallback];

    // Last Resort Fallback
    modelsToTry.push('llama-3.1-8b-instant');

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];

        // Load Balance Keys
        const start = Math.floor(Math.random() * groqKeys.length);

        for (let k = 0; k < Math.min(3, groqKeys.length); k++) {
            const keyIndex = (start + k) % groqKeys.length;
            try {
                const client = getGroqClient(keyIndex);

                const completion = await client.chat.completions.create({
                    messages: messages,
                    model: model,
                    temperature: temperature,
                    max_tokens: maxTokens,
                    stream: true,
                });

                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) yield content;
                }
                return; // Success!

            } catch (error: any) {
                console.warn(`[Stream Client] Failed ${model} (Key ${keyIndex}): ${error?.message}`);
                // If 404, stop retrying keys for this model
                if (error?.status === 404) break;
            }
        }
    }

    // If we get here, everything failed.
    console.error("❌ safeStreamCompletion: All models exhausted.");
    throw new Error("Brain Offline");
}

// --- 3. THE BRAIN (Subconscious Decision Maker) ---
export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {

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
    - **Bad:** "I can help you", "Try this", "Do you want to talk?". (AI asking User)
    - **Good:** "I feel anxious", "Play some music", "Tell me more". (User answering AI)

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
      "mood": "happy" | "sad" | "concerned" | "sassy" | "calm" | "excited" | "neutral" | "angry",
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
        const rawJson = await safeChatCompletion('brain', messages, 0.6, 500, true);
        const parsed = JSON.parse(rawJson) as SubconsciousBlock;

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

// --- 4. THE VOICE STREAMER (Client Fallback) ---
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  
  // Format history for Groq (Text Only)
  const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || "" 
      }))
  ];

  try {
      const stream = safeStreamCompletion('soul', messages, 0.7, maxTokens || 1024);
      for await (const chunk of stream) {
          if (chunk) yield chunk;
      }
  } catch (e) {
      console.error("Client Voice Stream Failed:", e);
      throw e;
  }
}
