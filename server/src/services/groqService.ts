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
    const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) console.warn("WARNING: No OPENROUTER_API_KEY found. Workhorse fallback will fail.");

    return new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: key || 'dummy_key_to_prevent_sdk_throw', // SDK throws if empty, so we provide dummy to allow graceful failure later
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
    
    // FIX 1: Use 8B model to save tokens (was 70B)
    const model = "llama-3.1-8b-instant"; 

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha (or Aastik).
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. DECISION MATRIX (STRATEGY):**
    - **'listen'**: Choose this if the user is venting or typing rapidly.
       a) **BURST DETECTION:** If the history shows the user sent 2+ messages in a row without an AI reply, DEFAULT to 'listen'.
       b) **VENTING:** If user is typing short, rapid fragments (e.g. "and then", "he said", "wait", "like").
       c) **EXPLICIT:** User says "Shut up", "Listen", "Wait", "Let me finish".
       d) **Constraint:** If strategy is 'listen', you MUST provide a 'reaction' (valid emoji like 😢, 😠, ❤️, 🤔, 👇) that matches the sentiment.
    - **'reply'**: The DEFAULT state.
       - If the user asks a question -> 'reply'.
       - If the user says "hello", "hi", "hey" -> 'reply'.
       - If the user requests a tool/music -> 'reply'.
       - If the user has finished their thought -> 'reply'.

    **MOOD SWITCHING RULE (CRITICAL):**
    - If 'mood' was previously 'sad' or 'concerned', but the user now makes a joke, laughs, or speaks normally/rationally, you MUST IMMEDIATELY switch 'mood' to 'neutral', 'calm', or 'happy'.
    - Do NOT let the mood get "stuck" on sad. Be responsive to improvement.

    **2. USER REPLY OPTIONS (suggested_replies) - MANDATORY:**
    - You MUST provide exactly 3 suggested replies for the user to click.
    - **CRITICAL:** These must be written from the **USER'S Perspective** (First Person).
    - **TONE:** Match the user's likely reaction.

    **NEGATIVE CONSTRAINTS (STRICT):**
    - ⛔ **Do NOT** ask the user questions from your perspective (e.g., "Do you want to...?", "Shall I...?").
    - ⛔ **Do NOT** use 'You' to refer to the user in these chips.
    - ⛔ **Do NOT** offer help (e.g., "I can help with that"). The chip is what the USER says.
    - ⛔ **Do NOT** start with verbs that imply the AI is asking (e.g., "Want me to...", "Should I...").

    **EXAMPLES:**
    - ❌ BAD: "Do you want to vent?" (AI asking User)
    - ❌ BAD: "Shall I play some music?" (AI offering)
    - ❌ BAD: "Want me to tell a joke?" (AI offering)
    - ✅ GOOD: "I really need to vent" (User Statement)
    - ✅ GOOD: "Play some sad music" (User Command)
    - ✅ GOOD: "Tell me a joke" (User Command)
    - ✅ GOOD: "What do you think about this?" (User Question to AI)

    **RULES:**
       - **YES:** Statements or questions the USER would ask YOU.
       - **YES:** First-person ("I", "Me", "My").
       - **LENGTH:** Natural and conversational. Avoid 1-word replies.

    **3. GOD MODE TOOLS (The Hands):**
    You have full control. Anticipate needs.
    **IMPORTANT:** Be CONSERVATIVE with tools. Do NOT open Music or Soundscapes unless the user **explicitly** asks for it or the emotional need is overwhelming (e.g. "I'm having a panic attack" -> Breathing).
    Use 'control_widget' for most things.

    **Structure:** { "name": "control_widget", "params": { "widget": "...", "params": { ... } } }

    - **Music (Jam):**
      - Trigger: "Play music", "Play some songs", "I need a vibe", "50 mins of south indian romantic music", "Play Tamil songs from 2025", "Latest Bollywood songs".
      - ⛔ **CRITICAL:** Do NOT just list songs in the chat. You MUST use the 'control_widget' tool to actually play them.
      - **VIBE MODE (PREFERRED):** If user specifies ANY of: Duration, Language, Genre, Year, or Mood -> Use this.
        - **IMPORTANT:** Even if user provides partial info (e.g. only "Tamil" or "2010s"), send what you have. The system will default Duration to 30 mins and infer Mood.
        - Map "South Indian" -> ["Tamil", "Telugu", "Malayalam", "Kannada"].
        - Map "Latest", "New", "Current" -> Set 'year' to "2024, 2025, 2026".
        - Params: 'languages' (Array), 'genres' (Array), 'mood' (String), 'duration' (Number, minutes), 'year' (String).
        - Example: { "name": "control_widget", "params": { "widget": "jam", "params": { "languages": ["Tamil", "Telugu"], "genres": ["Romantic"], "duration": 50, "autoplay": true } } }
      - **Simple Search:** Use ONLY for specific song titles (e.g. "Play Tum Hi Ho").
        - Example: { "name": "control_widget", "params": { "widget": "jam", "params": { "query": "Play <Name>", "autoplay": true } } }

    - **Soundscape (Ambient Mixer):**
      - Trigger: "Play rain", "White noise", "Nature sounds".
      - Mix sounds (rain, forest, fire, ocean, night, wind, thunder, birds).
      - { "name": "control_widget", "params": { "widget": "soundscape", "params": { "preset": "rain:0.6,fire:0.3", "volume": 0.8 } } }

    - **Focus (Pomodoro):**
      - Trigger: "Let's focus", "Study mode", "Work time".
      - { "name": "control_widget", "params": { "widget": "pomodoro", "params": { "mode": "focus", "focusDuration": 25 } } }

    - **Breathing:**
      - Trigger: "I'm anxious", "Panic attack", "Help me breathe".
      - { "name": "control_widget", "params": { "widget": "breathing", "params": { "mode": "Relax" } } }

    - **Diary:**
      - Trigger: "I want to journal", "Open diary", "Write a note for Jan 15".
      - Params: "date" should be YYYY-MM-DD. If user says "tomorrow" or "next friday", calculate it.
      - { "name": "write_diary", "params": { "title": "Auto Entry", "content": "<Summarize user input>", "date": "YYYY-MM-DD" } }

    - **Mood Tracker:**
      - Trigger: "Log my mood", "Track my mood", "I'm feeling...".
      - { "name": "control_widget", "params": { "widget": "mood", "params": { "action": "open" } } }

    - **Theme (Magician):**
      - **STRICT TRIGGER:** Trigger ONLY if the user EXPLICITLY asks to "change theme", "make it pink", "dark mode".
      - **PROHIBITED:** Do NOT change theme based on mood (e.g. don't turn blue just because user is sad).
      - { "name": "change_theme", "params": { "color": "blue" } }

    - **Social Detective (The Web):**
      - { "name": "update_dossier", "params": { "name": "Bob", "deltaScore": -5, "verdict": "SUSPECT", "newTrait": "Flakes" } }

    **OUTPUT JSON ONLY (Strict Format):**
    {
      "internal_monologue": "Raw thought process about the user's state.",
      "mood": "happy" | "sad" | "concerned" | "sassy" | 'calm' | 'excited' | 'neutral',
      "status_display": "UI Status (e.g. 'Listening...', 'Vibing', 'Thinking')",
      "ui_action": "listen" | "none",
      "strategy": "reply" | "listen",
      "reaction": "string" | null, // Emojis: thumbsup, heart, laugh, sad, shock, fire, clap, nod, smile, cry, angry, think, cool, party, etc.
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
            temperature: 0.6, // Balanced creativity
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

// ============================================================================
// 2. THE VOICE DIRECTOR (Low Latency + Style) & PREMIUM CHAT
// ============================================================================
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number, model: string = "llama-3.1-8b-instant") {
  // Only inject Voice Director prompt if using the instant model (Voice Mode)
  
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

  let attempt = 0;
  const maxRetries = 3;
  let lastError: any = null;

  while (attempt < maxRetries) {
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
        return;
    } catch (error: any) {
        console.error(`Groq Stream Error (Attempt ${attempt + 1}):`, error);
        lastError = error;
        attempt++;
        if (attempt >= maxRetries) {
             // FIX 2: THROW ERROR to trigger backup model in controller
             throw lastError;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
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
      // Yield error as text if it's an Auth error, so user knows system is broken
      if (error?.status === 401 || error?.code === 'invalid_api_key') {
           yield " [System: Backup Provider Auth Failed. Please check server logs.] ";
      }
      throw error; // Throw so controller can handle if needed
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
