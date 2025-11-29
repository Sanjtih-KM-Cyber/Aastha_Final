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

// Simple round-robin or random key selection
const getGroqClient = () => {
  const randomKey = groqKeys.length > 0 
    ? groqKeys[Math.floor(Math.random() * groqKeys.length)] 
    : 'dummy_key_missing';
  
  return new Groq({ apiKey: randomKey });
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  // Content can be a simple string OR an array (for multimodal structures, though Groq Llama 3 only takes text)
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function* streamGroq(history: ChatMessage[], systemPrompt: string) {
  // 1. Check for images. Groq (Llama 3) is text-only.
  const hasImage = history.some(msg => Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url'));
  
  if (hasImage) {
      yield "I apologize, but I cannot see images right now. Please describe the image to me so I can help.";
      return;
  }

  // 2. Select Model
  const model = "llama-3.1-8b-instant";

  // 3. Format Messages for Groq
  // FIX: Removed the appended "STANDARD MODE (Llama 3)" text. 
  // Now it uses ONLY your system prompt as the source of truth.
  const messages: any[] = [
      { role: 'system', content: systemPrompt }
  ];

  for (const msg of history) {
      if (typeof msg.content === 'string') {
          messages.push({ role: msg.role, content: msg.content });
      } else {
          // If content is array, extract just the text parts
          const textPart = msg.content.find(c => c.type === 'text')?.text || "";
          if (textPart) messages.push({ role: msg.role, content: textPart });
      }
  }

  try {
      const groqClient = getGroqClient();

      const completion = await groqClient.chat.completions.create({
          messages: messages,
          model: model,
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
      });

      for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) yield content;
      }
  } catch (error) {
      console.error("Groq Error:", error);
      yield " [Connection unstable. Please try again.]";
  }
}