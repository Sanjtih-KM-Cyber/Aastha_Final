import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Rotate keys to prevent rate limits
const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (groqKeys.length === 0) {
  console.warn("Warning: No GROQ_API_KEYS found. Basic chat mode may fail.");
}

const getGroqClient = () => {
  const randomKey = groqKeys.length > 0 
    ? groqKeys[Math.floor(Math.random() * groqKeys.length)] 
    : 'dummy_key_missing';
  return new Groq({ apiKey: randomKey });
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
        name: 'write_diary' | 'read_diary' | 'control_widget' | 'update_dossier';
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
    const model = "llama-3.1-8b-instant"; // Fast & Smart

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha (or Aastik).
    Your job is NOT to speak. Your job is to FEEL, DECIDE, and DIRECT the interface.

    User Context:
    ${userContext}

    **1. DECISION MATRIX (STRATEGY):**
    - **'listen'**: Choose this ONLY if:
       a) User is venting/ranting (deep distress, anger, sadness) AND needs space.
       b) User text is LONG (>15 words) or part of a rapid burst.
    - **'reply'**: Choose this for EVERYTHING else (Default).
       - Questions, greetings, fillers, casual chat.
       - If they ask for help or tools.
       - **CRITICAL EXCEPTIONS (FORCE 'reply'):**
         - If user says filler words ("hmm", "okay", "yeah", "cool", "wait", "lol", "k").
         - If user requests a TOOL (Music, Focus, Timer, Breathing, Diary, etc.).
         - If user gives a COMMAND ("Let's focus", "Play music", "Start breathing", "Help me relax").

    **2. SMART CHIPS (suggested_replies):**
    - Generate 3 chips from the **USER'S PERSPECTIVE** (1st Person).
    - **NEGATIVE CONSTRAINTS:**
       - Do NOT ask questions in chips (e.g. "How are you?").
       - Do NOT use 2nd person (e.g. "Do you want...").
    - **Good Examples:** "I'm exhausted", "That makes sense", "Let's distract me", "I need advice", "Just listen".

    **3. GOD MODE TOOLS (The Hands):**
    You have full control. Anticipate needs. Use 'control_widget' for most things.

    **Structure:** { "name": "control_widget", "params": { "widget": "...", "params": { ... } } }

    - **Music (Jam):**
      - Song/Podcast: { "name": "control_widget", "params": { "widget": "jam", "params": { "query": "Play <Name>", "autoplay": true } } }
      - Mood/Vibe: { "name": "control_widget", "params": { "widget": "jam", "params": { "mood": "chill", "genre": "lofi", "autoplay": true } } }

    - **Soundscape (Ambient Mixer):**
      - Mix sounds (rain, forest, fire, ocean, night, wind, thunder, birds).
      - { "name": "control_widget", "params": { "widget": "soundscape", "params": { "preset": "rain:0.6,fire:0.3", "volume": 0.8 } } }

    - **Focus (Pomodoro):**
      - Trigger: "Let's focus", "Study mode", "Work time".
      - { "name": "control_widget", "params": { "widget": "pomodoro", "params": { "mode": "focus", "focusDuration": 25 } } }

    - **Breathing:**
      - Trigger: "I'm anxious", "Panic attack", "Help me breathe".
      - { "name": "control_widget", "params": { "widget": "breathing", "params": { "mode": "Relax" } } }

    - **Diary:**
      - Trigger: "I want to journal", "Open diary".
      - { "name": "write_diary", "params": { "title": "Auto Entry", "content": "<Summarize user input>" } }

    - **Social Detective (The Web):**
      - { "name": "update_dossier", "params": { "name": "Bob", "deltaScore": -5, "verdict": "SUSPECT", "newTrait": "Flakes" } }

    **OUTPUT JSON ONLY (Strict Format):**
    {
      "internal_monologue": "Raw thought process about the user's state.",
      "mood": "happy" | "sad" | "concerned" | "sassy" | 'calm' | 'excited' | 'neutral',
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
            temperature: 0.6, // Balanced creativity
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw) as SubconsciousBlock;

        // Failsafe for UI Action consistency
        if (parsed.strategy === 'listen') parsed.ui_action = 'listen';
        else parsed.ui_action = 'none';

        // FORCE CORRECT CHIP PERSPECTIVE (FAILSAFE)
        // If chips look like questions, try to sanitize them simply
        if (parsed.suggested_replies) {
             parsed.suggested_replies = parsed.suggested_replies.map(chip => {
                 if (chip.endsWith('?')) return chip.replace('?', '.');
                 return chip;
             });
        }

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
// 2. THE VOICE STREAMER (Fallback for Free Tier)
// ============================================================================
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
          temperature: 0.7, // Higher temp for more personality in voice
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
