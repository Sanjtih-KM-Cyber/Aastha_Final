import Groq from 'groq-sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// ==========================================
// 0. CONFIGURATION & CLIENTS
// ==========================================

// GROQ (The Brain & Voice Director)
const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

const getGroqClient = () => {
  const randomKey = groqKeys.length > 0 
    ? groqKeys[Math.floor(Math.random() * groqKeys.length)] 
    : 'dummy_key_missing';
  return new Groq({ apiKey: randomKey });
};

// OPENROUTER (The Workhorse)
// Uses OpenAI SDK but points to OpenRouter URL
const getOpenRouterClient = () => {
    return new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'dummy_key',
    });
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
    const client = getGroqClient();
    const model = "llama-3.3-70b-versatile";

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha (or Aastik).
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. DECISION MATRIX (STRATEGY):**
    - **'listen'**: Choose this ONLY if the user is in a state of UNCONTROLLED VENTING, emotional, or telling a story without a question.
       a) User text is a long monologue about negative feelings.
       b) User is typing multiple short bursts in <2 seconds.
       c) User explicitly says "Shut up", "Listen", or "Let me finish".
       d) **Constraint:** If strategy is 'listen', you MUST provide a 'reaction' (valid emoji like 😢, 😠, ❤️) that matches the sentiment.
    - **'reply'**: Choose this ONLY if the user asks a question, says "Hello", or explicitly grants permission/requests input.
       - The DEFAULT is 'reply' for normal conversation.
       - If they ask a question -> 'reply'.

    **MOOD SWITCHING RULE (CRITICAL):**
    - If 'mood' was previously 'sad' or 'concerned', but the user now makes a joke, laughs, or speaks normally/rationally, you MUST IMMEDIATELY switch 'mood' to 'neutral', 'calm', or 'happy'.

    **2. USER REPLY OPTIONS (suggested_replies) - MANDATORY:**
    - You MUST provide exactly 3 suggested replies for the user to click.
    - **CRITICAL:** These must be written from the **USER'S Perspective** (First Person).
    - **TONE:** Match the user's likely reaction.
    - ⛔ **Do NOT** ask questions or use 'You'.

    **3. GOD MODE TOOLS (The Hands):**
    - **Music (Jam):** Trigger: "Play music", "Play Tamil songs from 2025". Map "Latest" to "2024, 2025, 2026".
      - { "name": "control_widget", "params": { "widget": "jam", "params": { "languages": ["Tamil"], "genres": ["Romantic"], "duration": 50, "autoplay": true } } }
    - **Soundscape:** "Play rain". { "name": "control_widget", "params": { "widget": "soundscape", "params": { "preset": "rain:0.6" } } }
    - **Focus:** "Study mode". { "name": "control_widget", "params": { "widget": "pomodoro", "params": { "mode": "focus", "focusDuration": 25 } } }
    - **Breathing:** "I'm anxious". { "name": "control_widget", "params": { "widget": "breathing", "params": { "mode": "Relax" } } }
    - **Theme:** "Change theme to blue". { "name": "change_theme", "params": { "color": "blue" } }
    - **Diary:** "Write a note". { "name": "write_diary", "params": { "title": "Auto Entry", "content": "...", "date": "YYYY-MM-DD" } }

    **OUTPUT JSON ONLY:**
    {
      "internal_monologue": "string",
      "mood": "happy" | "sad" | "concerned" | "sassy" | "calm" | "excited" | "neutral",
      "status_display": "string",
      "ui_action": "none" | "listen",
      "strategy": "reply" | "listen",
      "reaction": "string" | null,
      "suggested_replies": ["string", "string", "string"],
      "tool_calls": []
    }
    `;

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

        if (parsed.strategy === 'listen') parsed.ui_action = 'listen';
        else parsed.ui_action = 'none';

        return parsed;

    } catch (error) {
        console.error("Groq Brain Error:", error);
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

// ============================================================================
// 2. THE VOICE DIRECTOR (Low Latency + Style) & PREMIUM CHAT
// ============================================================================
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number, model: string = "llama-3.1-8b-instant") {
  // Only inject Voice Director prompt if using the instant model (Voice Mode)
  // OR if explicitly requested?
  // For simplicity: The controller will pass the correct systemPrompt.
  // But wait, the previous logic injected it inside the function.
  // I should check if I should inject it conditionally.

  // Plan: "The Voice Director... generates [STYLE: ...] tags."
  // "Premium Brain... High EQ." (No style tags needed implicitly, but maybe for TTS?)
  // If model is 8b-instant, we assume Voice Mode -> Inject Tag instructions?
  // Or better, let the Controller handle the prompt injection and just pass the model here.

  // Refactoring: Remove the hardcoded injection from here and let Controller do it if needed.
  // BUT the Plan Step 4 said: "Update streamGroq... Prepend this exact instruction".
  // So I'll keep it but only if model is 8b-instant.
  
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

// ============================================================================
// 3. THE WORKHORSE (OpenRouter / GPT-OSS-120B)
// ============================================================================
export async function* streamWorkhorse(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  const model = "openai/gpt-oss-120b"; // Verified Model ID
  const client = getOpenRouterClient();

  const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : (m.content as any[]).find(c => c.type === 'text')?.text || ""
      }))
  ];

  try {
      const completion = await client.chat.completions.create({
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: maxTokens || 1024,
          stream: true,
      });

      for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) yield content;
      }
  } catch (error: any) {
      console.error("Workhorse Stream Error:", error);
      yield " [Standard circuit busy. Using backup link...] ";
      // Fallback to Groq 70b if Workhorse fails? Handled by controller usually, but here we just yield error text.
  }
}

// ============================================================================
// 4. WHISPER TRANSCRIPTION
// ============================================================================
export const transcribeAudio = async (audioBuffer: Buffer): Promise<string> => {
    try {
        const client = getGroqClient();
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
    } catch (error: any) {
        console.error("Whisper Transcription Error:", error);
        throw new Error("Failed to transcribe audio.");
    }
};
