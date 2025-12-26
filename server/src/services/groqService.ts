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
  // Content can be string or array (for multimodal inputs handled by Gemini)
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function* streamGroq(history: ChatMessage[], systemPrompt: string, maxTokens?: number) {
  // 1. Check for images
  // Groq's Llama 3.1 8b is text-only. If the user sent an image, we must handle it gracefully.
  const hasImage = history.some(msg => Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url'));
  
  if (hasImage) {
      yield "I apologize, but I cannot see images while in Standard Mode (Groq). Please switch to Premium or describe the image to me.";
      return;
  }

  // 2. Select Model
  const model = "llama-3.1-8b-instant";

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
          temperature: 0.6, // Slightly creative but stable
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
