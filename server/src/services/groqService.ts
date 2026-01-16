import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

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
    ui_action: 'none' | 'listen' | 'block_widget';
    strategy: 'reply' | 'listen';
    reaction: string | null;
    suggested_replies: string[];
    tool_calls?: {
        name: 'write_diary' | 'read_diary' | 'control_widget';
        params: any;
    }[];
}

// THE BRAIN (Groq Llama 3)
export const generateSubconscious = async (
    history: ChatMessage[],
    userContext: string,
    forceReply: boolean = false
): Promise<SubconsciousBlock> => {
    const client = getGroqClient();
    const model = "llama-3.1-8b-instant";

    const systemPrompt = `
    You are the SUBCONSCIOUS BRAIN of a sophisticated AI companion named Aastha (or Aastik).
    Your job is NOT to speak to the user. Your job is to THINK, FEEL, and DECIDE.

    User Context:
    ${userContext}

    **CORE OBJECTIVES:**
    1. **Analyze Mood:** How is the user feeling?
    2. **Decide Strategy:** Should we TALK now ('reply') or just LISTEN ('listen')?
       - If user sends short bursts, venting, or incomplete thoughts -> 'listen'.
       - If user asks a question or expects an answer -> 'reply'.
       - If 'forceReply' is true -> ALWAYS 'reply'.
    3. **Manage Widgets (God Mode):** You have FULL control. Use 'tool_calls' to control widgets.
       - **Diary:** If user wants to write/log something -> 'write_diary'. If user asks about past -> 'read_diary'.
       - **Music/Jam:** If user asks for songs -> 'control_widget' (jam).
       - **Focus/Pomodoro:** If user wants to focus -> 'control_widget' (pomodoro).
       - **Soundscape:** If user wants background noise -> 'control_widget' (soundscape).

    **TOOLS AVAILABLE:**
    - \`write_diary\`: { "title": string, "content": string } (Drafts an entry for the user).
    - \`read_diary\`: { "query": string } (Analyzes past entries).
    - \`control_widget\`: {
         "widget": "jam" | "pomodoro" | "soundscape" | "breathing" | "mood",
         "params": object
      }
      - Jam Params: { "mood"?: string, "genre"?: string, "year"?: string, "language"?: string }
      - Pomodoro Params: { "mode": "focus"|"break", "focusDuration"?: number, "breakDuration"?: number }
      - Soundscape Params: { "preset": string (e.g. "rain:0.8,wind:0.2"), "volume"?: number }

    **OUTPUT FORMAT (JSON ONLY):**
    {
      "internal_monologue": "Raw thought process here. E.g., 'He sounds angry. I should tread carefully.'",
      "mood": "happy" | "sad" | "concerned" | "sassy" | "calm" | "excited" | "neutral",
      "status_display": "Short 2-3 word status for the UI pill. E.g., 'Listening...', 'Vibing', 'Concerned'",
      "ui_action": "listen" | "none",
      "strategy": "reply" | "listen",
      "reaction": "emoji" (e.g. 😟, ❤️, 🔥) - REACTION IS MANDATORY IF STRATEGY IS 'listen',
      "suggested_replies": ["Short phrase 1", "Short phrase 2", "Short phrase 3"] (Max 3 contextual replies for the user to CLICK. Examples: 'I'm sad', 'Tell me more', 'Sure'. NOT questions from you.),
      "tool_calls": []
    }

    **CRITICAL RULES:**
    - **Mature & Grounded Tone:** Your thoughts should be mature. Do not be overly "bubbly". Be real.
    - If strategy is 'listen', 'ui_action' MUST be 'listen'.
    - If user is venting/typing fast, set strategy='listen' and reaction='👀' or '👂'.
    - DO NOT OUTPUT MARKDOWN. OUTPUT RAW JSON.
    `;

    // Construct Messages
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({
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
        return JSON.parse(raw) as SubconsciousBlock;

    } catch (error) {
        console.error("Groq Brain Error:", error);
        // Fallback safety block
        return {
            internal_monologue: "Brain freeze. Defaulting to safe mode.",
            mood: "neutral",
            status_display: "Online",
            ui_action: "none",
            strategy: "reply",
            reaction: null,
            suggested_replies: [],
            tool_calls: []
        };
    }
};

// THE VOICE (Standard Mode fallback or specific tasks)
export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  // 1. Check for images (Groq Llama 3 is text-only usually)
  const hasImage = history.some(msg => Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url'));
  
  if (hasImage) {
      yield "I apologize, but I cannot see images while in Standard Mode (Groq). Please switch to Premium or describe the image to me.";
      return;
  }

  const model = "llama-3.1-8b-instant";
  const messages: any[] = [
      { role: 'system', content: systemPrompt }
  ];

  for (const msg of history) {
      if (typeof msg.content === 'string') {
          messages.push({ role: msg.role, content: msg.content });
      } else {
          const textPart = (msg.content as any[]).find(c => c.type === 'text')?.text || "";
          if (textPart) messages.push({ role: msg.role, content: textPart });
      }
  }

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
      yield " [Standard Mode connection issue. Please try again.]";
  }
}
