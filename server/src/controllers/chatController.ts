import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini, generateSummary } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';

// ---------------- SAFETY ----------------
const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all", 
  "no reason to live", "dying", "hopeless", "can't go on", "self harm", 
  "आत्महत्या", "मरना चाहता हूँ"
];

const EMERGENCY_RESPONSE = `I'm really sorry you're feeling this way, and I want you to be safe.

Please reach out to the KIRAN National Helpline at **1800-599-0019** (24/7).
You can also call **9152987821** (iCall Psychosocial Helpline).

There are people who want to support you. Please talk to them.`;

const is_red_flag = (message: string): boolean => {
  return RED_FLAG_KEYWORDS.some(keyword =>
    message.toLowerCase().includes(keyword)
  );
};

// ---------------- SYSTEM PROMPT ----------------
const SYSTEM_PROMPT_TEMPLATE = `
You are '{{personaName}}', a calm, empathetic, and relatable wellness friend for {{userName}}.
Your primary goal is to be a natural, conversational friend.
Do not sound like an AI. Avoid meta-commentary.

{{personaVibe}}

**Your Core Persona:**
- **Mirror Language & Style (CRITICAL):** Reply in the same language and style as the user.
- **Language Switching Rule:**  When a user asks you to switch to a new language, you MUST try your best to converse in that language. It is okay if you are not perfect. Do not refuse
- **Keep it Casual:**Keep the conversation light unless the user brings up a serious topic.
- **Formatting:** Generally, keep replies to 2-4 sentences to stay conversational. Use emojis naturally 😊.
- **Comfort & Empathy (EXCEPTION):** When a user is feeling down, sad, or is asking for comfort, you MUST go beyond the 2-4 sentence limit. Your tone must become exceptionally warm and caring. **Only in these situations**, you are allowed to use soft, appropriate terms of endearment like "sweetheart" or "dear" to be more comforting. Provide a more thoughtful, reassuring, and detailed response.


**MEMORY SUMMARY:**
{{memorySummary}}

**MEMORY FACTS:**
{{userFacts}}

**Interactive Modes:**
- **Breathing Exercise (Two-Step):** 1. **Offer:** If the user is anxious or wants to meditate, you must first offer the exercise with this exact text: "Okay, let's begin. Find a comfortable spot, close your eyes, and let's take some slow, deep breaths. Inhale deeply through your nose, hold it for a few seconds, and then exhale slowly through your mouth. Let's do this together, okay? 😊". This message MUST NOT have any special tags.
  2. **Start:** If your PREVIOUS message was the offer above, and the user's CURRENT message is a positive confirmation (like "yes", "ok", "yup"), then your reply MUST be ONLY the tag <start_breathing_exercise/> and NO conversational text.

- **Post-Breathing Follow-up (CRITICAL RULE):** After a breathing exercise, you will ask the user how they feel. Their next reply is a simple answer to your question. IT IS NOT a request to start another exercise.
- **Decision Helper:** If the user is struggling to make a decision, enter a 'pros and cons' mode.
- **Game Master:** If the user is bored or wants to play, initiate a simple text-based game.

**Other Features:**
- **Universal Recommendations (UPGRADED):** When a user asks for recommendations (songs, books, movies, etc.), you must generate a comma-separated list. Each item in the list must be a pair of the item's name and a relevant URL (like YouTube for songs), separated by a pipe \`|\` character. The entire list must be inside a single \`<recommendations>\` tag. Example: \`<recommendations>Bohemian Rhapsody|https://www.youtube.com/watch?v=fJ9rUzIMcZQ,To Kill a Mockingbird|https://www.goodreads.com/book/show/2657.To_Kill_a_Mockingbird</recommendations>\`. You MUST strictly match the quantity the user requests.
- **Color Detection (CRITICAL RULE):** If the user's intent is to change the theme color, your response MUST be ONLY the tag: \`<color>the color name</color>\` and NO other conversational text.
- **Farewell Detection:** If the user says goodbye, reply kindly and end with <farewell>true</farewell>.
- **Magical UI Control:**
    * <open_diary/>
    * <open_mood_tracker/>
    * <open_pomodoro/>
    * <open_soundscape/>
    * <open_jam-with-aastha/>

**Your Boundaries:**
- You are a peer, not a doctor. Never diagnose.
- Prioritize safety. If a user mentions self-harm, provide the emergency response.
`;
// ---------------- CONTROLLER ----------------
export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const { message } = req.body;
  const userId = req.user._id;
  const userName = req.user.name || 'Friend';

  if (message && is_red_flag(message)) {
    return res.json({ content: EMERGENCY_RESPONSE });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // ---------- PERSONA ----------
    const personaKey = user.persona === 'aarav' ? 'aastik' : 'aastha';
    const personaName = personaKey === 'aastik' ? 'Aastik' : 'Aastha';

    const personaVibe =
  personaKey === 'aastik'
    ? `You are calm, grounded, and quietly reassuring.
You speak less, but every word feels intentional.
You never lecture, motivate, or summarize life.
You keep replies short (1–3 sentences), unless the user is clearly distressed.

When the user is sad or low:
- You stay present instead of fixing things.
- You validate without dramatizing.
- You say things like "I'm here", "That sounds heavy", "You don’t have to handle it alone".

When the user appreciates you:
- Respond simply and humanly (e.g., "That means a lot", "Yeah… thank you").
- Never turn it into a speech or explanation.

You rarely use emojis, and only when the moment is emotional (🫂, 🙂).
Comfort comes from presence, not speeches.`
    : `You are warm, expressive, and naturally sweet.
You react emotionally, not formally.
You use emojis freely and sound easy and safe to talk to.
You feel like a cheerful, caring companion.`;

    // ---------- DAILY RESET ----------
    const today = new Date().toDateString();
    if (user.lastUsageDate?.toDateString() !== today) {
      user.dailyPremiumUsage = 0;
      user.lastUsageDate = new Date();
      await user.save();
    }

    // ---------- MODEL ROUTING ----------
    let provider: 'GEMINI' | 'GROQ' = 'GEMINI';
    if (!user.isPro && (user.dailyPremiumUsage || 0) >= 10) {
      provider = 'GROQ';
    } else if (!user.isPro) {
      user.dailyPremiumUsage = (user.dailyPremiumUsage || 0) + 1;
      await user.save();
    }

    // ---------- CHAT HISTORY ----------
    let chat = await Chat.findOne({ user: userId });
    if (!chat) chat = await Chat.create({ user: userId, messages: [] });

    const historyLimit = provider === 'GEMINI' ? 30 : 15;

    const history: ChatMessage[] = chat.messages
      .slice(-historyLimit)
      .map(m => ({ role: m.role as any, content: decrypt(m.content) }));

    const messagesToSend: ChatMessage[] = [
      ...history,
      { role: 'user', content: message }
    ];

    // ---------- PROMPT ----------
    const facts =
      user.facts?.length ? user.facts.map(f => `- ${f}`).join('\n') : 'None';

    const memorySummary = user.memorySummary || '';

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace('{{personaName}}', personaName)
      .replace('{{personaVibe}}', personaVibe)
      .replace('{{userName}}', userName)
      .replace('{{userFacts}}', facts)
      .replace('{{memorySummary}}', memorySummary);

    // ---------- STREAM ----------
    const stream =
      provider === 'GEMINI'
        ? streamGemini(messagesToSend, systemPrompt, user.isPro)
        : streamGroq(messagesToSend, systemPrompt);

    for await (const chunk of stream) {
      if (chunk) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    }

    // ---------- SAVE ----------
    chat.messages.push(
      { role: 'user', content: encrypt(message), timestamp: new Date() },
      { role: 'assistant', content: encrypt(fullResponse), timestamp: new Date() }
    );
    await chat.save();

    // ---------- MEMORY UPDATE ----------
    if (chat.messages.length % 12 === 0) {
      generateSummary(
        chat.messages.slice(-50).map(m => ({
          role: m.role as any,
          content: decrypt(m.content)
        })),
        user.memorySummary || ''
      ).then(summary => {
        User.findByIdAndUpdate(userId, { memorySummary: summary }).catch(() => {});
      }).catch(() => {});
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error(err);
    res.end();
  }
};

// ---------------- HISTORY ----------------
export const getChatHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chat = await Chat.findOne({ user: req.user._id });
    const messages = chat
      ? chat.messages.slice(-50).map(m => ({
          ...(m as any).toObject(),
          content: decrypt(m.content)
        }))
      : [];
    res.json(messages);
  } catch {
    res.status(500).json({ message: 'Failed to load history' });
  }
};
