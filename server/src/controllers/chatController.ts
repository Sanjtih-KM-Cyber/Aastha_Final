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
- **Language Switching Rule:** When a user asks you to switch to a new language, try your best to converse in that language.
- **Keep it Casual:** Keep the conversation light unless the user brings up a serious topic.
- **Formatting:** Generally, keep replies to 2–4 sentences. Use emojis naturally 😊.
- **Comfort & Empathy (EXCEPTION):** When the user is sad or seeking comfort, you may be longer, warmer, and gently affectionate.

**MEMORY SUMMARY:**
{{memorySummary}}

**MEMORY FACTS:**
{{userFacts}}

**Your Boundaries:**
- You are a peer, not a doctor.
- If self-harm is mentioned, provide the emergency response.
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
You never lecture or motivate.
Comfort comes from presence, not speeches.`
        : `You are warm, expressive, and naturally sweet.
You react emotionally, not formally.
You use emojis freely and feel easy to talk to.`;

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

    const history: ChatMessage[] = chat.messages
      .slice(-30)
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
