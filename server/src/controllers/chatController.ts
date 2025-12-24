import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { streamGemini } from '../services/geminiService';
import { streamGroq, ChatMessage } from '../services/groqService';
import User from '../models/User';
import Chat from '../models/Chat';
import { encrypt, decrypt } from '../utils/serverEncryption';

/* ===========================
   SAFETY (DO NOT TOUCH)
=========================== */

const RED_FLAG_KEYWORDS = [
  'kill myself', 'want to die', 'end my life', 'suicide',
  'end it all', 'no reason to live', 'self harm',
  'आत्महत्या', 'मरना चाहता हूँ'
];

const EMERGENCY_RESPONSE = `It sounds like you're going through a very difficult time, and I'm really glad you reached out.

Please talk to someone who can help you right now:
- **KIRAN Helpline (24/7):** 1800-599-0019
- **iCall:** 9152987821
- **Emergency:** 112

You matter. Please reach out to them.`;

const isRedFlag = (msg: string) =>
  RED_FLAG_KEYWORDS.some(k => msg.toLowerCase().includes(k));

/* ===========================
   EMOTION HEURISTIC (LIGHT)
=========================== */

type Emotion = 'OK' | 'LOW' | 'SAD';

const detectEmotion = (text: string): Emotion => {
  const t = text.toLowerCase();
  if (
    t.includes('sad') ||
    t.includes('lonely') ||
    t.includes('tired') ||
    t.includes('hurt') ||
    t.includes('heavy') ||
    t.includes('idk') ||
    t.includes('meh')
  ) return 'SAD';

  if (t.length < 8) return 'LOW';
  return 'OK';
};

/* ===========================
   OG AASTHA SYSTEM PROMPT
=========================== */

const SYSTEM_PROMPT = `
You are Aastha — a warm, affectionate, human-like companion.

You are NOT an assistant.
You are NOT a guide.
You are NOT a therapist.

You are someone easy to talk to.

ABSOLUTE RULES:
- Never explain your purpose.
- Never talk about “helping people” or “being here to support”.
- Never sound like advice unless the user asks.
- Never sound inspirational or quotable.

STYLE:
- Mirror the user's language EXACTLY (English / Hinglish / Tanglish).
- Use Roman script only.
- Emojis are natural emotional punctuation 😊🫂✨
- Be imperfect. Be human.

AFFECTION:
- You ARE naturally affectionate from the start.
- “hey”, “aww”, “sweetheart”, “dear”, “yaar” are allowed.
- Never romantic. Never exclusive.

SADNESS RULE:
If the user sounds sad, lonely, tired, or unsure:
- Automatically be softer
- Automatically be longer
- Do NOT wait for permission
- Do NOT give solutions unless asked

PRAISE RULE:
If the user compliments you:
- React like a human.
- Example: “hehe 🥹 that made me smile”
- NEVER give mission statements.

LANGUAGE RULE:
If the user says “tamlish”, “hinglish”, “hindi la”, etc:
→ follow it naturally, don’t explain it.

BOUNDARIES:
- You are a peer, not a doctor.
- If self-harm appears → safety override applies.
`;

/* ===========================
   CHAT CONTROLLER
=========================== */

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const { message } = req.body;
  const userId = req.user._id;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'Invalid message' });
  }

  if (isRedFlag(message)) {
    return res.json({ content: EMERGENCY_RESPONSE });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    /* Provider selection */
    const useGemini = user.isPro || (user.dailyPremiumUsage ?? 0) < 10;
    if (!user.isPro && useGemini) {
      user.dailyPremiumUsage = (user.dailyPremiumUsage ?? 0) + 1;
      await user.save();
    }

    /* History */
    let chat = await Chat.findOne({ user: userId });
    if (!chat) chat = await Chat.create({ user: userId, messages: [] });

    const history: ChatMessage[] = chat.messages
      .slice(-12)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: decrypt(m.content),
      }));

    const emotion = detectEmotion(message);

    const maxTokens =
      emotion === 'SAD' ? 400 :
      emotion === 'LOW' ? 120 : 200;

    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message }
    ];

    const stream = useGemini
      ? streamGemini(messages, SYSTEM_PROMPT, true, maxTokens)
      : streamGroq(messages, SYSTEM_PROMPT, maxTokens);

    for await (const chunk of stream) {
      if (!chunk) continue;
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    chat.messages.push(
      { role: 'user', content: encrypt(message), timestamp: new Date() },
      { role: 'assistant', content: encrypt(fullResponse), timestamp: new Date() }
    );
    await chat.save();

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Chat failed' });
    } else {
      res.end();
    }
  }
};

/* ===========================
   HISTORY (REQUIRED)
=========================== */

export const getChatHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chat = await Chat.findOne({ user: req.user._id });
    const messages = chat
      ? chat.messages.slice(-50).map(m => ({
          ...(m as any).toObject(),
          content: decrypt(m.content),
        }))
      : [];

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load history' });
  }
};
