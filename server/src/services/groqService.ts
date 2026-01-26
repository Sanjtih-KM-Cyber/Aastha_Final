import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// ==========================================
// 0. CONFIGURATION & CLIENTS
// ==========================================

// GROQ KEYS (Load all available keys for rotation)
const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

// Helper: Get a specific Groq client by index
const getGroqClient = (index: number) => {
  if (groqKeys.length === 0) {
      return new Groq({ apiKey: 'dummy' });
  }
  const key = groqKeys[index % groqKeys.length];
  return new Groq({ apiKey: key });
};

// GEMINI (The Ultimate Backup)
const getGeminiClient = () => {
    const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',');
    const key = keys[Math.floor(Math.random() * keys.length)]?.trim();
    if (!key) return null;
    return new GoogleGenerativeAI(key);
};

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
        name: 'write_diary' | 'read_diary' | 'control_widget' | 'update_dossier' | 'change_theme';
        params: any;
    }[];
}

// ============================================================================
// 2026 GOLDEN STACK ARCHITECTURE
// ============================================================================
const MODEL_CONFIG = {
    soul: {
        primary: 'qwen/qwen3-32b',
        fallback: 'meta-llama/llama-4-maverick-17b-128e-instruct'
    },
    brain: {
        primary: 'meta-llama/llama-4-scout-17b-16e-instruct',
        fallback: 'llama-3.1-8b-instant'
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
                // console.log(`[Groq] Attempting ${category} with ${model} (Key ${keyIndex})`);

                const completion = await client.chat.completions.create({
                    messages: messages,
                    model: model,
                    temperature: temperature,
                    max_tokens: maxTokens,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                });

                return completion.choices[0]?.message?.content || "";

            } catch (error: any) {
                const isRateLimit = error?.status === 429;
                const isNotFound = error?.status === 404;
                console.warn(`[Groq] Failed ${model} (Key ${keyIndex}): ${error?.message || error}`);

                // If 404 (Model not found), break key loop immediately and try next model
                if (isNotFound) break;
            }
        }
        console.warn(`[Groq] Dropping model ${model} for ${category}...`);
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

    // Last Resort Fallback (Real Model) if specific fallbacks fail
    // This is crucial if the user provided "Future Models" that don't exist yet.
    modelsToTry.push('llama-3.1-8b-instant');

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];

        // Load Balance Keys
        const start = Math.floor(Math.random() * groqKeys.length);

        for (let k = 0; k < Math.min(3, groqKeys.length); k++) {
            const keyIndex = (start + k) % groqKeys.length;
            try {
                const client = getGroqClient(keyIndex);
                // console.log(`[Stream] Attempting ${category} with ${model} (Key ${keyIndex})`);

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
                console.warn(`[Stream] Failed ${model} (Key ${keyIndex}): ${error?.message}`);
                // If 404, stop retrying keys for this model
                if (error?.status === 404) break;
            }
        }
    }

    // If we get here, everything failed.
    console.error("❌ safeStreamCompletion: All models exhausted.");
    throw new Error("Brain Offline");
}


// ============================================================================
// 1. THE BRAIN (Subconscious Decision Maker)
// ============================================================================
export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha.
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. GREETING PROTOCOL (PRIORITY #1):**
    - If the input is a GREETING in ANY language/script -> **STRATEGY: 'reply'**.

    **2. DRY TEXTING / BOREDOM PROTOCOL (PRIORITY #2):**
    - **Is the user being "Dry"?** ("nice", "ok", "cool") -> **STRATEGY: 'reply'**.
    - **GOAL:** CARRY the conversation.

    **3. DECISION MATRIX (STRATEGY):**
    - **'listen'**: Choose if user is **unfinished**, **hesitant**, or **venting**.
    - **'reply'**: Choose if user is **waiting for you**, **asking a question**, **greeting**, or **DRY TEXTING**.

    **4. REACTIONS (THE FACE):**
    - SAD/CRYING -> 😢, 💔, 🫂
    - ANGRY/RANTING -> 😯, 🤐, 💀 (Do NOT react with Angry).
    - HAPPY/JOKING -> 😂, ✨, 🔥, 😄.
    - FLIRTY -> 😳, 🥰, 😉.

    **5. USER REPLY OPTIONS (suggested_replies):**
    - Must be **USER'S Perspective** (First Person).
    - Ex: "I really need to vent", "Play some sad music", "Tell me a joke".

    **6. GOD MODE TOOLS (The Hands):**
    - **Music:** { "name": "control_widget", "params": { "widget": "jam", "params": { "languages": ["Tamil"], "genres": ["Melody"], "duration": 30, "autoplay": true } } }
    - **Soundscape:** { "name": "control_widget", "params": { "widget": "soundscape", "params": { "preset": "rain:0.6" } } }
    - **Focus:** { "name": "control_widget", "params": { "widget": "pomodoro", "params": { "action": "start", "focusDuration": 25 } } }
    - **Breathing:** { "name": "control_widget", "params": { "widget": "breathing", "params": { "mode": "Relax" } } }
    - **Diary:** { "name": "write_diary", "params": { "title": "Auto", "content": "...", "date": "YYYY-MM-DD" } }
    - **Theme:** { "name": "change_theme", "params": { "color": "blue" } }

    **OUTPUT JSON ONLY:**
    {
      "internal_monologue": "Raw thought process.",
      "mood": "happy"|"sad"|"concerned"|"sassy"|"calm"|"excited"|"neutral",
      "status_display": "Thinking...",
      "ui_action": "listen"|"none",
      "strategy": "reply"|"listen",
      "reaction": "string"|null,
      "suggested_replies": ["..."],
      "tool_calls": []
    }
    `;

    // Construct Messages (Keep only last 5 turns)
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-5).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Image/Media]'
        }))
    ];

    if (forceReply) {
        messages.push({ role: "system", content: "USER FORCE TRIGGER: Stop listening. Reply now." });
    }

    try {
        // USE "THE BRAIN" (Logic/Routing)
        const rawJson = await safeChatCompletion('brain', messages, 0.6, 500, true);
        const parsed = JSON.parse(rawJson) as SubconsciousBlock;

        // Hard Overrides
        if (forceReply) {
            parsed.strategy = 'reply';
            parsed.ui_action = 'none';
            parsed.status_display = 'Thinking...';
        } else {
            if (parsed.strategy === 'listen') parsed.ui_action = 'listen'; else parsed.ui_action = 'none';
        }

        if (parsed.strategy === 'listen' && !parsed.reaction) {
            parsed.reaction = '👇';
        }

        return parsed;

    } catch (error) {
        console.error("Subconscious Failed:", error);
        // Emergency Fallback (Gemini could be added here, but keeping it simple as safeChatCompletion already has fallbacks)
        return {
            internal_monologue: "System Reboot...",
            mood: "neutral",
            status_display: "Rebooting...",
            ui_action: "none",
            strategy: "reply",
            reaction: null,
            suggested_replies: ["I'm here", "Wait", "Reload"],
            tool_calls: []
        };
    }
};

// ============================================================================
// 2. THE VOICE DIRECTOR (The Streamer)
// ============================================================================
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number, model?: string) {

  // NOTE: The 'model' arg is preserved for backward compatibility but ignored in favor of Golden Stack
  
  let finalPrompt = systemPrompt;
  // Inject Voice Tags Logic if not present (simplified check)
  if (!systemPrompt.includes("Voice Director")) {
      finalPrompt = `
      You are the Voice Director.
      **1. DETECT LANGUAGE & SCRIPT:**
      - English -> No Style Tags.
      - Regional/Hinglish -> [STYLE: <emotion>, <speed>][TTS: <native_script>].
      ${systemPrompt}`;
  }

  const messages: any[] = [
      { role: 'system', content: finalPrompt },
      ...history.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || "" 
      }))
  ];

  // USE "THE SOUL" (Chat & Roleplay) for Voice
  try {
      const stream = safeStreamCompletion('soul', messages, 0.7, maxTokens || 1024);
      for await (const chunk of stream) {
          if (chunk) yield chunk;
      }
  } catch (e) {
      console.error("Voice Stream Failed:", e);
      throw e;
  }
}

// ============================================================================
// 3. THE WORKHORSE (Legacy Name -> Now Uses Golden Stack)
// ============================================================================
export async function* streamWorkhorse(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  
  const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || ""
      }))
  ];

  // USE "THE SOUL" (Chat) OR "THE HANDS" (Complex)?
  // ChatController uses Workhorse for non-voice/complex chats.
  // We'll map it to 'soul' for consistency in personality, but could be 'hands' if tool use is heavy.
  // Given user description: "THE SOUL (Chat & Roleplay)" fits best.

  try {
      const stream = safeStreamCompletion('soul', messages, 0.7, maxTokens || 1024);
      for await (const chunk of stream) {
          if (chunk) yield chunk;
      }
  } catch (e) {
      console.error("Workhorse Stream Failed:", e);
      
      // Ultimate Fallback: Gemini Flash (if SafeStream completely died)
      try {
          const gemini = getGeminiClient();
          if (!gemini) throw new Error("No Gemini");
          const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

          const chatHistory = history.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: typeof m.content === 'string' ? m.content : '[Image]' }]
          }));

          const chat = model.startChat({ history: chatHistory, systemInstruction: systemPrompt });
          const result = await chat.sendMessageStream("Continue");
          for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) yield text;
          }
      } catch (geminiError) {
          console.error("Gemini Workhorse Error:", geminiError);
          yield " [System: Brain Overload. Please try again in 5 minutes.] ";
      }
  }
}

// ============================================================================
// 4. WHISPER TRANSCRIPTION
// ============================================================================
export const transcribeAudio = async (audioBuffer: Buffer): Promise<string> => {
    // Rotation for Whisper too
    const start = Math.floor(Math.random() * groqKeys.length);
    for (let i = 0; i < groqKeys.length; i++) {
        const keyIndex = (start + i) % groqKeys.length;
        try {
            const client = getGroqClient(keyIndex);
            const tempPath = `/tmp/upload_${Date.now()}.m4a`;
            fs.writeFileSync(tempPath, audioBuffer);

            const transcription = await client.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-large-v3",
                response_format: "json",
                language: "en",
                temperature: 0.0
            });

            fs.unlinkSync(tempPath);
            return transcription.text;
        } catch (error) {
            console.warn(`Whisper Key ${keyIndex+1} Failed. Trying next...`);
        }
    }
    return "[Audio processing failed due to server load]";
};
