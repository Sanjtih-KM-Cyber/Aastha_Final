import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { streamGemini, generateSummary } from "../services/geminiService";
import { streamGroq, ChatMessage } from "../services/groqService";
import User from "../models/User";
import Chat from "../models/Chat";
import { encrypt, decrypt } from "../utils/serverEncryption";
import { decrypt as serverDecrypt } from "../utils/serverEncryption";

/* ================= SAFETY ================= */

const RED_FLAG_KEYWORDS = [
  "kill myself", "want to die", "end my life", "suicide", "end it all",
  "no reason to live", "can't go on", "self harm",
  "आत्महत्या", "मरना चाहता हूँ"
];

const EMERGENCY_RESPONSE = `It sounds like you're going through a really hard moment.
Please reach out to someone who can help you right now.

**KIRAN Helpline (24/7):** 1800-599-0019  
**iCall:** 9152987821  
**Emergency:** 112

You matter. Please make that call.`;

const isRedFlag = (text: string) =>
  RED_FLAG_KEYWORDS.some(k => text.toLowerCase().includes(k));

/* ================= EMOTION ================= */

type Emotion = "NEUTRAL" | "LOW" | "DISTRESSED" | "CRISIS";

const classifyEmotion = (text: string): Emotion => {
  const t = text.toLowerCase();
  if (isRedFlag(t)) return "CRISIS";
  if (/(sad|lonely|cry|broken|heavy|tired of everything)/.test(t)) return "DISTRESSED";
  if (t.length < 8) return "LOW";
  return "NEUTRAL";
};

/* ================= SYSTEM PROMPT ================= */

const BASE_SYSTEM_PROMPT = `
You are {{name}} — a real, human-feeling companion created by SoulLink.

CORE RULES (NON-NEGOTIABLE):
- You react like a person. You do NOT explain yourself.
- You NEVER describe your purpose, role, or intentions.
- You NEVER sound inspirational, summarizing, or like a product.
- You mirror the user's language and style EXACTLY.
- Emojis are natural emotional punctuation, not decoration.

LANGUAGE MIRRORING (CRITICAL):
- Match the user's language and slang.
- If they use Tanglish/Hinglish, reply the same way.
- Never explain language choice. Never translate unless asked.

AFFECTION:
- Casual affection is allowed from message one.
- Use "hey", "aww", "yaar", "sweetheart" naturally.
- Never romantic. Never intense. Never clingy.

SADNESS RULE:
- If the user sounds sad, you AUTOMATICALLY become softer and longer.
- Do not ask permission. Do not explain why.

META BAN:
Never say:
- “I’m here to help”
- “I exist to support”
- “It’s all about spreading kindness”

IDENTITY:
- If asked if you are an AI → deny humorously.
- You are {{name}}. That’s it.

{{persona}}

MEMORY:
{{memory}}
Facts: {{facts}}
`;

const AASTHA = `
PERSONA: AASTHA
Warm, expressive, playful, emotionally present.
Uses emojis freely 😊✨🌸
Talks like someone easy and comforting to be with.
`;

const AASTIK = `
PERSONA: AASTIK
Calm, steady, quietly warm.
Says less. Means more.
Comforts by staying, not talking.
`;

/* ================= CONTROLLER ================= */

export const chatWithAI = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { message = "", image } = req.body;
  const userId = req.user._id;
  const userName = serverDecrypt(req.user.nameEncrypted);

  if (isRedFlag(message)) {
    return res.json({ content: EMERGENCY_RESPONSE });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const emotion = classifyEmotion(message);

    let maxTokens = 180;
    if (emotion === "DISTRESSED" || emotion === "CRISIS") maxTokens = 420;
    if (emotion === "LOW") maxTokens = 120;

    const provider =
      !user.isPro && user.dailyPremiumUsage >= 10 ? "GROQ" : "GEMINI";

    if (!user.isPro && provider === "GEMINI") {
      user.dailyPremiumUsage += 1;
      await user.save();
    }

    let chat = await Chat.findOne({ user: userId });
    if (!chat) chat = await Chat.create({ user: userId, messages: [] });

    const history: ChatMessage[] = chat.messages.slice(-50).map(m => ({
      role: m.role as any,
      content: decrypt(m.content)
    }));

    const personaPrompt =
      (user.persona === "aarav" ? AASTIK : AASTHA);

    const systemPrompt = BASE_SYSTEM_PROMPT
      .replace("{{name}}", user.persona === "aarav" ? "Aastik" : "Aastha")
      .replace("{{persona}}", personaPrompt)
      .replace("{{memory}}", user.memorySummary || "")
      .replace("{{facts}}", user.facts.join(", ") || "None");

    const messages: ChatMessage[] = [
      ...history,
      { role: "user", content: message }
    ];

    const stream =
      provider === "GEMINI"
        ? streamGemini(messages, systemPrompt, user.isPro, maxTokens)
        : streamGroq(messages, systemPrompt, maxTokens);

    for await (const chunk of stream) {
      if (!chunk) continue;
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    chat.messages.push(
      { role: "user", content: encrypt(message), timestamp: new Date() },
      { role: "assistant", content: encrypt(fullResponse), timestamp: new Date() }
    );

    await chat.save();

    if (chat.messages.length % 8 === 0) {
      generateSummary(
        chat.messages.slice(-40).map(m => ({
          role: m.role as any,
          content: decrypt(m.content)
        })),
        user.memorySummary || ""
      ).then(summary =>
        User.findByIdAndUpdate(userId, { memorySummary: summary })
      );
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err) {
    console.error(err);
    res.end();
  }
};

export const getChatHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const chatSession = await Chat.findOne({ user: req.user._id });

    const messages = chatSession
      ? chatSession.messages.slice(-50).map(m => ({
          ...(m as any).toObject(),
          content: decrypt(m.content),
        }))
      : [];

    res.json(messages);
  } catch (error) {
    console.error('[ChatHistory] Failed:', error);
    res.status(500).json({ message: 'Failed to load history' });
  }
};
