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
      // Return dummy if no keys, logic will fail over to Gemini
      return new Groq({ apiKey: 'dummy' });
  }
  // Pick specific key based on index to ensure rotation
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
// 1. THE BRAIN (Subconscious Decision Maker)
// ============================================================================
export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {
    
    // OPTIMIZATION: Use 8B for thoughts to save tokens/TPM. 
    // It is fast and smart enough for JSON logic.
    const model = "llama-3.1-8b-instant"; 

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion.
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. STRATEGY (DECISION MATRIX):**
    - **'listen'**: Choose ONLY if user is clearly venting or typing rapidly.
       a) **BURST:** If user sent 2+ long messages (>5 words) in a row without reply.
       b) **IGNORE FILLERS:** Do NOT choose 'listen' for short inputs like "hmm", "ok", "cool", "yea", "lol", "wait". Treat these as 'reply'.
       c) **EXPLICIT:** "Shut up", "Listen to me", "Let me finish".
       d) **Constraint:** Must provide 'reaction' emoji (😢, 😠, ❤️, 🤔, 👇).
    - **'reply'**: The DEFAULT.
       - Questions, Greetings, Commands, Short responses -> 'reply'.

    **MOOD SWITCHING:**
    - If 'mood' was previously 'sad', but user now jokes/laughs/speaks normally, SWITCH to 'neutral'/'happy' immediately.

    **2. SMART CHIPS (suggested_replies) - STRICTLY USER POV:**
    - Provide 3 options for the USER to click.
    - **MUST BE FIRST PERSON (I, Me, My).**
    - **NEVER** ask the user a question (e.g., "Do you want...?").
    - **NEVER** offer help (e.g., "Shall I...?").
    - ❌ BAD: "Do you want to vent?" (AI asking)
    - ❌ BAD: "Shall I play music?" (AI offering)
    - ✅ GOOD: "I need to vent" (User saying)
    - ✅ GOOD: "Play sad music" (User commanding)
    - ✅ GOOD: "Tell me a joke" (User commanding)
    - ✅ GOOD: "What do you think?" (User asking)

    **3. GOD MODE TOOLS (The Hands):**
    - **Music:** { "name": "control_widget", "params": { "widget": "jam", "params": { "query": "Play <Name>", "autoplay": true } } }
       - Map "Latest/New" -> Year "2024, 2025".
       - Map "South Indian" -> ["Tamil", "Telugu"].
       - Vibe Mode Preferred for vague requests (Mood, Language, Genre).
    - **Soundscape:** "Play rain". { "name": "control_widget", "params": { "widget": "soundscape", "params": { "preset": "rain" } } }
    - **Focus:** "Study mode". { "name": "control_widget", "params": { "widget": "pomodoro", "params": { "mode": "focus" } } }
    - **Diary:** "Open diary". { "name": "write_diary", "params": { ... } }
    - **Theme:** { "name": "change_theme", "params": { "color": "blue" } } (ONLY if explicitly asked).

    **OUTPUT JSON ONLY:**
    {
      "internal_monologue": "string",
      "mood": "happy"|"sad"|"concerned"|"sassy"|"calm"|"excited"|"neutral",
      "status_display": "string",
      "ui_action": "listen"|"none",
      "strategy": "reply"|"listen",
      "reaction": "string"|null,
      "suggested_replies": ["string", "string", "string"],
      "tool_calls": []
    }
    `;

    // Construct Messages (Reduced history to 5 for speed)
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-5).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Image/Media]'
        }))
    ];

    if (forceReply) {
        messages.push({ role: 'system', content: "SYSTEM OVERRIDE: User explicitly requested a reply. Set strategy to 'reply'." });
    }

    // --- STRATEGY A: ROTATE GROQ KEYS ---
    for (let i = 0; i < groqKeys.length; i++) {
        try {
            const client = getGroqClient(i);
            const response = await client.chat.completions.create({
                messages: messages,
                model: model,
                temperature: 0.6, // Balanced creativity
                max_tokens: 500,
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0]?.message?.content || "{}";
            const parsed = JSON.parse(raw) as SubconsciousBlock;

            // FORCE OVERRIDES
            if (forceReply) {
                parsed.strategy = 'reply';
                parsed.ui_action = 'none';
            }

            // Failsafe for UI Action consistency
            if (parsed.strategy === 'listen') parsed.ui_action = 'listen';
            else parsed.ui_action = 'none';

            return parsed; // SUCCESS!

        } catch (error: any) {
            console.warn(`⚠️ Subconscious: Groq Key ${i+1}/${groqKeys.length} Failed (${error?.status || error?.message}). Trying next...`);
            // Continue loop
        }
    }

    // --- STRATEGY B: GEMINI FLASH FALLBACK ---
    console.error("❌ Subconscious: All Groq Keys Exhausted. Switching to GEMINI FLASH.");
    try {
        const gemini = getGeminiClient();
        if (!gemini) throw new Error("No Gemini Keys");

        const model = gemini.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            generationConfig: { responseMimeType: "application/json" } 
        });

        const chat = model.startChat({
            history: history.slice(-5).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: typeof m.content === 'string' ? m.content : '[Image]' }]
            })),
            systemInstruction: systemPrompt
        });

        const result = await chat.sendMessage("Analyze and Respond JSON");
        const text = result.response.text();
        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText) as SubconsciousBlock;
        
        if (forceReply) {
             parsed.strategy = 'reply';
             parsed.ui_action = 'none';
        } else {
             if (parsed.strategy === 'listen') parsed.ui_action = 'listen'; else parsed.ui_action = 'none';
        }

        return parsed;

    } catch (geminiError) {
         console.error("Gemini Subconscious Failed:", geminiError);
         return {
            internal_monologue: "Systems critical...",
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
// 2. THE VOICE DIRECTOR (Low Latency + Style) & PREMIUM CHAT
// ============================================================================
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number, model: string = "llama-3.1-8b-instant") {
  
  let finalPrompt = systemPrompt;
  if (model === "llama-3.1-8b-instant") {
      finalPrompt = `
      You are the Voice Director. You MUST start every response with a style tag: [STYLE: <emotion>, <pitch>, <speed>].
      Example: [STYLE: Whispering, high, slow].
      The audio engine reads this. Do not speak the tag.

      ${systemPrompt}`;
  }

  const messages: any[] = [
      { role: 'system', content: finalPrompt },
      ...history.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || "" 
      }))
  ];

  // RETRY LOGIC: Rotate keys instead of retrying same key
  for (let i = 0; i < groqKeys.length; i++) {
    try {
        const groqClient = getGroqClient(i);
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
        return; // Success!
    } catch (error: any) {
        console.warn(`Groq Stream Key ${i+1} Failed: ${error?.error?.code || error.message}`);
        // Continue to next key
    }
  }

  // If loop finishes, all keys failed
  throw new Error("All Groq Keys Rate Limited");
}

// ============================================================================
// 3. THE WORKHORSE (GROQ 120B -> GEMINI FLASH FALLBACK)
// ============================================================================
export async function* streamWorkhorse(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  
  const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || ""
      }))
  ];

  // 1. PRIMARY: Try "openai/gpt-oss-120b" on Groq (with Key Rotation)
  for (let i = 0; i < groqKeys.length; i++) {
      try {
          const client = getGroqClient(i);
          const completion = await client.chat.completions.create({
              model: "openai/gpt-oss-120b", 
              messages: messages,
              temperature: 0.7,
              max_tokens: maxTokens || 1024,
              stream: true,
          });

          for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) yield content;
          }
          return; // Success!

      } catch (groqError: any) {
          console.warn(`⚠️ Workhorse (GPT-OSS-120B) Key ${i+1} Failed. Trying next...`);
      }
  }

  // 2. ULTIMATE BACKUP: Gemini 1.5 Flash (When Groq is 100% Dead)
  console.error("⚠️ All Groq Workhorse Keys Dead. Switching to GEMINI FLASH.");
  try {
      const gemini = getGeminiClient();
      if (!gemini) {
         yield " [System: No Backup Keys. Brain Offline.] ";
         return;
      }

      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const chatHistory = history.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: typeof m.content === 'string' ? m.content : '[Multimedia]' }]
      }));

      const chat = model.startChat({
          history: chatHistory,
          systemInstruction: systemPrompt
      });

      const lastMsg = chatHistory.length > 0 ? "Continue conversation" : "Hello";
      const result = await chat.sendMessageStream(lastMsg);

      for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
      }

  } catch (geminiError) {
      console.error("Gemini Workhorse Error:", geminiError);
      yield " [System: Brain Overload. Please try again in 5 minutes.] ";
  }
}

// ============================================================================
// 4. WHISPER TRANSCRIPTION
// ============================================================================
export const transcribeAudio = async (audioBuffer: Buffer): Promise<string> => {
    // Rotation for Whisper too
    for (let i = 0; i < groqKeys.length; i++) {
        try {
            const client = getGroqClient(i);
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
            console.warn(`Whisper Key ${i+1} Failed. Trying next...`);
        }
    }
    return "[Audio processing failed due to server load]";
};
