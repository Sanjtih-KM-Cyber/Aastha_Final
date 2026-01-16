import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { SubconsciousBlock } from './geminiService'; // Re-use interface

dotenv.config();

const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (groqKeys.length === 0) {
  console.warn("Warning: No GROQ_API_KEYS found. Subconscious/Standard mode may fail.");
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

/**
 * THE SUBCONSCIOUS MIND (GROQ 70B)
 * Analyzes context, decides mood, actions, and internal monologue.
 * Output is PURE JSON.
 */
export const analyzeContext = async (
    history: ChatMessage[],
    userFacts: string[],
    userName: string
): Promise<SubconsciousBlock> => {
    const groqClient = getGroqClient();

    // Prepare minimal context for speed (last 10 messages)
    const recentHistory = history.slice(-10).map(m => {
        const content = typeof m.content === 'string' ? m.content : "[Multimedia/Image]";
        return `${m.role.toUpperCase()}: ${content}`;
    }).join('\n');

    const systemPrompt = `
    You are the 'Subconscious Mind' of Aastha, an AI companion.
    Your job is to analyze the conversation and decide the internal state.

    User: ${userName}
    Facts: ${userFacts.join(', ')}

    **TASK:**
    Analyze the recent chat and output a JSON object with these fields:
    1. "internal_monologue": Your raw, unfiltered thoughts about the user's state. Be observant. (e.g., "He seems evasive about his exam results.")
    2. "mood": "happy" | "sad" | "concerned" | "sassy" | "calm" | "excited" | "neutral"
    3. "status_display": Short 2-3 word status for the UI pill (e.g., "Thinking...", "Worried", "Vibing", "Listening").
    4. "ui_action":
       - "listen" (If user asked to talk/voice mode/call)
       - "block_widget" (If user needs sleep/break - rarely used)
       - "none" (Default)
    5. "reaction": ONE emoji to stick on the USER'S last message. (e.g. ❤️, 😂, 🔥, 🥺). Null if no reaction needed.
    6. "suggested_replies": Array of 3 short strings. CRITICAL: These are for the USER to click. They must be written from the USER'S perspective.
       - BAD: "You look tired." (User saying this to AI?)
       - GOOD: "I'm exhausted.", "Tell me a story.", "Let's jam."

    **MATURITY GUIDELINES:**
    - Be mature. Do not default to "happy" if the topic is serious.
    - If the user is rude, be "sassy" or "calm", not "happy".

    Output ONLY valid JSON.
    `;

    try {
        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Recent Chat:\n${recentHistory}\n\nAnalyze now.` }
            ],
            model: "llama-3.3-70b-versatile", // High intelligence for reasoning
            temperature: 0.5,
            response_format: { type: "json_object" },
            max_tokens: 500
        });

        const jsonStr = completion.choices[0]?.message?.content || "{}";
        return JSON.parse(jsonStr) as SubconsciousBlock;

    } catch (e) {
        console.error("Groq Analysis Failed:", e);
        // Fallback default
        return {
            internal_monologue: "I am having trouble connecting to my subconscious.",
            mood: "neutral",
            status_display: "Online",
            ui_action: "none",
            reaction: null,
            suggested_replies: ["Hello", "How are you?", "Tell me a joke"]
        };
    }
};

export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  // 1. Check for images (Groq Llama 3 is text-only usually)
  const hasImage = history.some(msg => Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url'));
  
  if (hasImage) {
      yield "I apologize, but I cannot see images while in Standard Mode (Groq). Please switch to Premium or describe the image to me.";
      return;
  }

  // 2. Select Model
  const model = "llama-3.3-70b-versatile"; // Upgraded from 8b for better quality

  // 3. Construct Messages
  // IMPORTANT: The systemPrompt from the controller (containing Aastha/Aastik persona & Glish rules) 
  // MUST be the first message.
  const messages: any[] = [
      { role: 'system', content: systemPrompt }
  ];

  // 4. Append History
  for (const msg of history) {
      if (typeof msg.content === 'string') {
          messages.push({ role: msg.role, content: msg.content });
      } else {
          // If content is array (but no images found earlier), extract just the text parts
          const textPart = (msg.content as any[]).find(c => c.type === 'text')?.text || "";
          if (textPart) messages.push({ role: msg.role, content: textPart });
      }
  }

  try {
      const groqClient = getGroqClient();

      const completion = await groqClient.chat.completions.create({
          messages: messages,
          model: model,
          temperature: 0.7, // Slightly creative but stable
          max_tokens: maxTokens || 1024,
          stream: true,
      });

      for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) yield content;
      }
  } catch (error: any) {
      console.error("Groq Error:", error);
      yield " [Standard Mode connection issue. Please try again.]";
  }
}
