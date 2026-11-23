/**
 * LOCAL DEV SANDBOX — run the real API with an in-memory MongoDB, a seeded demo account and
 * (if no Groq/Gemini keys are set) a fake AI that streams friendly canned replies.
 * Lets you click through the app without touching production data or spending AI quota.
 *
 *   cd server && npm run dev:sandbox      → API on http://localhost:5000
 *   cd client && npm run dev              → app on http://localhost:3000
 *
 * Demo login (local sandbox only — never used anywhere else):
 *   email:    demo@aastha.test
 *   password: SandboxDemo#2026
 */
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  console.error('Refusing to start the dev sandbox in production.');
  process.exit(1);
}

const DEMO_EMAIL = process.env.SANDBOX_EMAIL || 'demo@aastha.test';
const DEMO_PASSWORD = process.env.SANDBOX_PASSWORD || 'SandboxDemo#2026';

(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server-core');
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('aastha_sandbox');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'sandbox-jwt-secret-not-for-production';
  process.env.SERVER_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY || 'sandbox-encryption-key-not-for-production';
  process.env.BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL || 'http://127.0.0.1:9'; // no voice notes in sandbox
  process.env.PORT = process.env.PORT || '5000';

  const hasRealAi = !!(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
  if (!hasRealAi) installFakeAi();
  if (process.env.BRAIN_SERVER_URL === 'http://127.0.0.1:9') installFakeVoice();

  // Start the real app (connects to the in-memory DB above)
  require('../src/app');

  const mongoose = require('mongoose');
  await new Promise<void>((resolve) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once('connected', () => resolve());
  });
  await seed();

  console.log('\n──────────────────────────────────────────────');
  console.log(' Aastha dev sandbox ready  →  http://localhost:' + process.env.PORT);
  console.log(` Demo login: ${DEMO_EMAIL}  (password in server/dev/sandbox.ts)`);
  console.log(` AI: ${hasRealAi ? 'REAL providers from your env' : 'fake canned replies (no keys set)'}`);
  console.log('──────────────────────────────────────────────\n');
})().catch((e) => {
  console.error('Sandbox failed to start:', e);
  process.exit(1);
});

async function seed() {
  const crypto = require('crypto');
  const bcrypt = require('bcryptjs');
  const User = require('../src/models/User').default;
  const { encrypt } = require('../src/utils/serverEncryption');
  const { encryptMasterKey, generateMasterKey } = require('../src/utils/cryptoUtils');
  const { appendMessages } = require('../src/services/messageStore');

  const emailHash = crypto.createHash('sha256').update(DEMO_EMAIL).digest('hex');
  if (await User.exists({ emailHash })) return;

  const user = await User.create({
    name: 'Demo',
    username: 'demo',
    usernameEncrypted: encrypt('demo'),
    dateOfBirth: new Date('2003-05-12'),
    emailHash,
    emailEncrypted: encrypt(DEMO_EMAIL),
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    masterKeyBlob1: await encryptMasterKey(generateMasterKey(), DEMO_PASSWORD),
    isVerified: true,
    isOnboardingComplete: true,
    persona: 'aastha',
    preferredLanguage: 'auto',
    bond: { points: 130, level: 2 },
  });

  const now = Date.now();
  const lines: [string, string][] = [
    ['user', 'hii'],
    ['assistant', "Hey you 🌸 how's your day going?"],
    ['user', 'kinda tired yaar, exams next week and I keep procrastinating'],
    ['assistant', "Ugh, that pre-exam slump is so real. Want to try one tiny 25-minute focus round together? No pressure — just one."],
    ['user', 'ok maybe later. what should I start with, maths or chem?'],
    ['assistant', "Start with whichever feels *slightly* less scary — momentum matters more than order. If maths has more marks riding on it, do 25 min of maths now and reward yourself with a break."],
  ];
  await appendMessages(
    user._id,
    lines.map(([role, content], i) => ({ role, content: encrypt(content), timestamp: new Date(now - (lines.length - i) * 60_000) }))
  );
  console.log('[Sandbox] Seeded demo user + sample conversation.');
}

const NL = String.fromCharCode(10);
/** Sandbox voice notes: a few seconds of speech-like tone bursts (16-bit mono WAV) so the player can be tested. */
function installFakeVoice() {
  const { brainService } = require('../src/services/brainService');
  brainService.generateSpeech = async (text: string) => {
    const rate = 16000;
    const secs = Math.min(12, Math.max(3, text.length / 18));
    const n = Math.floor(rate * secs);
    const buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
    buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const syllable = Math.max(0, Math.sin(t * Math.PI * 3.3)) * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.9)));
      const v = Math.sin(2 * Math.PI * 180 * t) * 0.5 + Math.sin(2 * Math.PI * 360 * t) * 0.25;
      buf.writeInt16LE(Math.round(v * syllable * 12000), 44 + i * 2);
    }
    return buf;
  };
  console.log('[Sandbox] Fake voice notes enabled (tone bursts).');
}

function installFakeAi() {
  const llm = require('../src/services/llm');
  const pick = (msgs: any[]) => {
    if (/AI imitation/.test(String(msgs[0]?.content || ''))) return 'arre yaar 😭 chal na, tell me everything... pakka?';
    const last = String([...msgs].reverse().find((m: any) => m.role === 'user')?.content || '').toLowerCase();
    if (/haha|lol|passed|yay/.test(last)) return 'Yesss, **that is huge!** I knew you *could* do it 🎉 [GIF: happy dance]';
    if (/format|markdown/.test(last)) return 'Okay so:' + NL + '- **bold** works' + NL + '- *italics* too' + NL + '- and ***both***' + NL + NL + '> no more stray stars';
    if (/should i|decide|confused/.test(last)) return 'Okay, let me think this through with you. Honestly? Go with the option you keep coming back to — but give it a small, low-stakes try first so it doesn\'t feel all-or-nothing.';
    if (/sad|tired|stress|anxious|low/.test(last)) return "That sounds heavy. I'm here — you don't have to fix it all tonight. Want to tell me the part that's weighing on you most?";
    if (/\b(hi+|hey|hello)\b/.test(last)) return 'Hey! 🌸 Good to see you. How are you feeling right now?';
    return "I hear you. Tell me a little more — I'm listening. (Sandbox reply: no AI keys configured.)";
  };
  const fake = {
    async *stream(_model: string, _k: number, msgs: any[]) {
      for (const word of pick(msgs).split(/(\s+)/)) {
        await new Promise((r) => setTimeout(r, 25));
        yield word;
      }
    },
    async complete(model: string, _k: number, msgs: any[]) {
      const hasImage = msgs.some((m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url'));
      if (hasImage) {
        // Clone Mode screenshot analysis (sandbox): a plausible style so the flow can be clicked through
        return JSON.stringify({ tone: 'warm, teasing', sentenceLength: 'short bursts', capitalisation: 'mostly lowercase', emoji: 'often 😭✨', punctuation: 'lots of "..."', language: 'Hinglish', phrases: ['arre yaar', 'chal na', 'pakka?'], quirks: ['double texts', 'replies with voice-note energy'] });
      }
      if (/real chat messages/.test(String(msgs[0]?.content || ''))) {
        return JSON.stringify({ tone: 'playful, dry', punctuation: 'rarely uses full stops', language: 'Banglish', phrases: ['ki re', 'chol'], quirks: ['double texts'] });
      }
      if (model.includes('brain') || model.includes('gpt-oss-20b')) {
        return JSON.stringify({ mood: 'calm', strategy: 'reply', reaction: null, suggested_replies: ['Tell me more', 'Play some music', 'Start a focus timer'], tool_calls: [] });
      }
      return JSON.stringify({ summary: '', new_facts: [], outdated_facts: [] });
    },
  };
  llm._setAdaptersForTest({ groq: fake, gemini: fake }, { groq: 1, gemini: 1 });
  // Fake GIF provider (sandbox only): skips the real GIPHY search and always returns one public GIPHY image URL.
  if (!process.env.GIPHY_API_KEY && !process.env.TENOR_API_KEY) {
    process.env.GIPHY_API_KEY = 'sandbox';
    const realFetch = (global as any).fetch;
    (global as any).fetch = async (url: any, init?: any) => String(url).startsWith('https://api.giphy.com/')
      ? { ok: true, json: async () => ({ data: [{ title: 'Happy dance (sandbox)', images: { fixed_height: { url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnB0d2t4cGx6b3B6b3B6/blSTtZehjAZ8I/giphy.gif', width: '200', height: '200' } } }] }) }
      : realFetch(url, init);
  }
  console.log('[Sandbox] No AI keys found — using fake canned replies.');
}
