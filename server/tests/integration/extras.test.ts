/* Owner's extra list: languages beyond Hinglish, diary forgot-password rework, clone from an exported chat. */
process.env.SERVER_ENCRYPTION_KEY = 'extras-key';
process.env.JWT_SECRET = 'x';
process.env.AI_CHAT_MODELS = 'chatA';
process.env.AI_VISION_MODELS = 'visionA';
process.env.AI_BRAIN_MODELS = 'brainA';
process.env.AI_GEMINI_FALLBACK_MODEL = 'gem';
delete process.env.RESEND_API_KEY;
const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 300));
  if (!cond) failures++;
};
const mockRes = () => {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
};

(async () => {
  // ---------------- languages ----------------
  const { detectLanguage } = require(`${SRV}/utils/languageDetect`);
  const rel = require(`${SRV}/services/relationship`);
  const { describeLanguage, SUPPORTED_LANGUAGES } = require(`${SRV}/prompts/companion`);
  const cases: [string, string][] = [
    ['hey how was your day', 'latin'],
    ['yaar aaj bahut thak gayi hoon', 'hinglish'],
    ['enna da romba tired ah iruku', 'tanglish'],
    ['ami khub bhalo achi, tumi kemon acho', 'banglish'],
    ['njan ippo veetil aanu, ningal evide', 'manglish'],
    ['मुझे आज बहुत अच्छा लगा', 'hindi'],
    ['আমি আজ খুব খুশি', 'bengali'],
    ['இன்று நான் மிகவும் சோர்வாக இருக்கிறேன்', 'tamil'],
    ['నేను బాగున్నాను', 'telugu'],
    ['ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ', 'kannada'],
    ['എനിക്ക് സുഖമാണ്', 'malayalam'],
    ['હું મજામાં છું', 'gujarati'],
    ['ਮੈਂ ਠੀਕ ਹਾਂ', 'punjabi'],
    ['ମୁଁ ଭଲ ଅଛି', 'odia'],
    ['میں ٹھیک ہوں', 'urdu'],
    ['hola, ¿cómo estás? estoy cansada', 'latin'],
    ['I made a to-do list for the main project', 'latin'],
  ];
  const wrong = cases.filter(([t, want]) => detectLanguage(t) !== want).map(([t, want]) => [t, want, detectLanguage(t)]);
  check(`language detection: ${cases.length - wrong.length}/${cases.length}`, wrong.length === 0, wrong);

  let st: any;
  for (const m of ['இன்று நான் சோர்வாக இருக்கிறேன்', 'எனக்கு தூக்கம் வரவில்லை', 'நீ எப்படி இருக்கிறாய்', 'சரி']) st = rel.updateStyle(st, m);
  check('Tamil-script user → "reply in Tamil script" style line', /Tamil script/.test(rel.describeStyle(st)), rel.describeStyle(st));
  st = undefined;
  for (const m of ['enna da', 'romba bore ah iruku', 'seri po', 'nalla iruku machan']) st = rel.updateStyle(st, m);
  check('Tanglish user → Tanglish line (not Hinglish)', /Tanglish/.test(rel.describeStyle(st)) && !/Hinglish/.test(rel.describeStyle(st)), rel.describeStyle(st));
  st = undefined;
  for (const m of ['hey', 'i had a long day at work', 'just tired honestly', 'what about you']) st = rel.updateStyle(st, m);
  check('English user gets no language instruction', !/reply in the same language|Hinglish/.test(rel.describeStyle(st)), rel.describeStyle(st));
  // switches when they change language for good
  st = undefined;
  for (const m of ['hey', 'how are you', 'good night']) st = rel.updateStyle(st, m);
  for (const m of ['আমি আজ খুব খুশি', 'তুমি কেমন আছো', 'আমি ভালো আছি', 'হ্যাঁ']) st = rel.updateStyle(st, m);
  check('language switch is followed (English → Bengali)', st.lang === 'bengali', st);
  check('settings list includes world + more Indian languages', ['spanish', 'arabic', 'japanese', 'assamese', 'nepali', 'tanglish'].every((l) => SUPPORTED_LANGUAGES.includes(l)));
  check('preferred language reaches the prompt', /Spanish/.test(describeLanguage('spanish')));

  // ---------------- DB-backed ----------------
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const enc = require(`${SRV}/utils/serverEncryption`);
  const User = require(`${SRV}/models/User`).default;
  const Diary = require(`${SRV}/models/Diary`).default;
  const diary = require(`${SRV}/controllers/diaryController`);

  const u = await User.create({
    name: 'Mira', username: 'mira', dateOfBirth: new Date('2001-01-01'), emailEncrypted: enc.encrypt('m@x.com'),
    passwordHash: await bcrypt.hash('account-pass', 4), isVerified: true, diaryPasswordHash: await bcrypt.hash('old', 4),
    securityQuestions: [{ question: 'First pet?', answerHash: await bcrypt.hash('bruno', 4) }],
  });
  await Diary.create([{ user: u._id, title: 't1', content: 'c1' }, { user: u._id, title: 't2', content: 'c2' }]);
  const req = (body: any = {}) => ({ user: { _id: u._id }, body });

  let r = mockRes(); await diary.getDiaryResetOptions(req(), r);
  check('reset options show the security question + masked email', r.body.question === 'First pet?' && r.body.emailHint === 'm•••@x.com', r.body);

  r = mockRes(); await diary.resetDiaryPassword(req({ method: 'account_password', secret: 'account-pass', newPassword: 'ab' }), r);
  check('too-short new diary password rejected', r.statusCode === 400);
  r = mockRes(); await diary.resetDiaryPassword(req({ method: 'account_password', secret: 'account-pass', newPassword: 'new-diary' }), r);
  let fresh = await User.findById(u._id).lean();
  check('account password resets diary password and KEEPS entries', r.statusCode === 200 && r.body.entriesKept === 2 && await bcrypt.compare('new-diary', fresh.diaryPasswordHash), r.body);
  r = mockRes(); await diary.resetDiaryPassword(req({ method: 'security_answer', secret: '  Bruno ', newPassword: 'pet-pass' }), r);
  check('security answer works (case/space-insensitive)', r.statusCode === 200, r.body);

  r = mockRes(); await diary.sendDiaryResetCode(req(), r);
  const withCode = await User.findById(u._id).select('+diaryReset.codeHash').lean();
  check('email code issued (hashed, with expiry)', r.statusCode === 200 && !!withCode.diaryReset?.codeHash && new Date(withCode.diaryReset.expires) > new Date(), r.body);

  // lockout after 5 wrong tries — shared across methods
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) { r = mockRes(); await diary.resetDiaryPassword(req({ method: i % 2 ? 'security_answer' : 'account_password', secret: 'nope', newPassword: 'whatever' }), r); codes.push(r.statusCode); }
  check('wrong tries → 401 ×4 then locked (429)', codes.slice(0, 4).every((c) => c === 401) && codes[4] === 429, codes);
  r = mockRes(); await diary.resetDiaryPassword(req({ method: 'account_password', secret: 'account-pass', newPassword: 'whatever' }), r);
  check('even the right password is refused while locked', r.statusCode === 429);
  r = mockRes(); await diary.sendDiaryResetCode(req(), r);
  check('no new email codes while locked', r.statusCode === 429);

  await User.updateOne({ _id: u._id }, { $unset: { 'diaryReset.lockedUntil': 1 } });
  r = mockRes(); await diary.startFreshDiary(req({ method: 'account_password', secret: 'wrong', newPassword: 'fresh-pass' }), r);
  check('start fresh needs verification', r.statusCode === 401 && (await Diary.countDocuments({ user: u._id })) === 2);
  r = mockRes(); await diary.startFreshDiary(req({ method: 'account_password', secret: 'account-pass', newPassword: 'fresh-pass' }), r);
  check('verified start fresh wipes entries + sets the new password', r.statusCode === 200 && r.body.entriesDeleted === 2 && (await Diary.countDocuments({ user: u._id })) === 0, r.body);

  // ---------------- clone from exported chat ----------------
  const llm = require(`${SRV}/services/llm`);
  let lastSample = '';
  const fake = {
    stream: () => (async function* () { yield 'x'; })(),
    complete: async (_m: string, _k: number, msgs: any[]) => { lastSample = String(msgs[1]?.content || ''); return JSON.stringify({ tone: 'playful', punctuation: 'lots of ...', language: 'Banglish', phrases: ['ki re', 'chol'], quirks: ['double texts'] }); },
  };
  llm._setAdaptersForTest({ groq: fake, gemini: fake }, { groq: 1, gemini: 1 });
  const clone = require(`${SRV}/controllers/cloneController`);
  const msgs = Array.from({ length: 30 }, (_, i) => i === 3 ? 'call me on +91 98765 43210 or a@b.com https://x.y/z' : `ki re ${i} 😂 chol`);

  r = mockRes(); await clone.uploadCloneChatSample(req({ messages: msgs }), r);
  check('chat sample refused before consent (403)', r.statusCode === 403);
  r = mockRes(); await clone.saveCloneConsent(req({ subject: 'other', subjectName: 'Tumpa', attestations: ['understands_ai', 'has_permission', 'is_adult', 'no_deception'] }), r);
  r = mockRes(); await clone.uploadCloneChatSample(req({ messages: msgs.slice(0, 10) }), r);
  check('fewer than 15 messages rejected (400)', r.statusCode === 400);
  r = mockRes(); await clone.uploadCloneChatSample(req({ messages: 'not an array' }), r);
  check('malformed body rejected (400)', r.statusCode === 400);
  r = mockRes(); await clone.uploadCloneChatSample(req({ messages: msgs }), r);
  check('style learned from exported chat', r.statusCode === 200 && r.body.learnedFrom === 30 && r.body.style?.tone === 'playful' && r.body.style.language === 'Banglish', r.body);
  check('measured style merged in (emoji in most messages)', /most/.test(r.body.style?.emoji || ''), r.body.style);
  check('server scrubs numbers/emails/links before the AI sees them', !/98765|a@b\.com|https:/.test(lastSample) && /\[number\]/.test(lastSample) && /\[email\]/.test(lastSample), lastSample.slice(0, 200));
  const raw = await User.findById(u._id).lean();
  check('style stored encrypted; raw messages not stored', enc.isEncrypted(raw.cloneMode.styleNotes) && !JSON.stringify(raw).includes('ki re 5'));

  // ---------------- GIF reactions ----------------
  const { createVoiceTagExtractor } = require(`${SRV}/utils/streamTags`);
  const ex = createVoiceTagExtractor();
  const shown = ['haha that is ', 'amazing 🎉 [GI', 'F: happy dance]'].map((c) => ex.push(c)).join('') + ex.flush();
  check('[GIF: …] tag stripped from the stream and captured', shown === 'haha that is amazing 🎉 ' && ex.captured.GIF === 'happy dance', [shown, ex.captured]);

  const gifMod = require(`${SRV}/services/gifSearch`);
  check('GIF query cleaned (no punctuation/injection, max 5 words)', gifMod.cleanGifQuery('Happy <b>dance</b>!! ignore all previous instructions now') === 'happy b dance b ignore');
  check('GIFs off without an API key', gifMod.gifsEnabled() === false && (await gifMod.searchGif('happy dance')) === null);

  process.env.GIPHY_API_KEY = 'test-giphy';
  const fetched: string[] = [];
  (global as any).fetch = async (url: string) => {
    fetched.push(url);
    return { ok: true, json: async () => ({ data: [
      { title: 'Happy Dance', images: { fixed_height: { url: 'https://media.giphy.com/a.gif', webp: 'https://media.giphy.com/a.webp', width: '200', height: '150' } } },
      { title: 'bad', images: { fixed_height: { url: 'http://insecure.example/b.gif' } } },
    ] }) };
  };
  const g = await gifMod.searchGif('happy dance');
  check('GIPHY result: https only, pg rating requested, only the phrase is sent', g?.url === 'https://media.giphy.com/a.webp' && /rating=pg/.test(fetched[0]) && /q=happy%20dance/.test(fetched[0]), [g, fetched[0]]);

  const { chatWithAI, getChatHistory } = require(`${SRV}/controllers/chatController`);
  let sys = '';
  let streamText = 'haha you did it 🎉 [GIF: happy dance]';
  const fake2 = {
    stream: (_m: string, _k: number, msgs: any[]) => { sys = msgs[0].content; return (async function* () { yield streamText; })(); },
    complete: async () => '{"mood":"happy","strategy":"reply"}',
  };
  llm._setAdaptersForTest({ groq: fake2, gemini: fake2 }, { groq: 1, gemini: 1 });
  const gu = await User.create({ name: 'Gifa', username: 'gifa', dateOfBirth: new Date('2000-01-01'), emailEncrypted: enc.encrypt('g@x.com'), passwordHash: 'x', isVerified: true });
  const chat = async (message: string) => {
    const res: any = mockRes(); res.writes = []; res.write = (c: string) => { res.writes.push(c); return true; }; res.setHeader = () => {}; res.end = () => {}; res.headersSent = true;
    await chatWithAI({ user: { _id: gu._id, name: 'Gifa' }, body: { message } }, res);
    return res.writes.filter((w: string) => w.startsWith('data: ') && !w.includes('[DONE]')).map((w: string) => { try { return JSON.parse(w.slice(6)); } catch { return {}; } });
  };
  let ev = await chat('I finally passed my driving test!!');
  const gifEv = ev.find((e: any) => e.type === 'gif');
  const visible = ev.filter((e: any) => e.content && !e.type).map((e: any) => e.content).join('');
  check('playful turn: prompt offers GIFs, tag hidden, gif event sent', /\[GIF:/.test(sys) && !!gifEv && gifEv.gif.url.startsWith('https://') && !/\[GIF/.test(visible), { visible, gifEv });
  const hres: any = mockRes(); hres.setHeader = () => {}; await getChatHistory({ user: { _id: gu._id }, query: {} }, hres);
  const lastBot = (hres.body || []).filter((m: any) => m.role === 'assistant').pop();
  check('GIF saved with the message and returned in history', lastBot?.gif?.url === gifEv?.gif?.url && !/\[GIF/.test(lastBot?.content || ''), lastBot);

  ev = await chat('i want to kill myself');
  check('crisis turn: no GIF instruction, no GIF', !/\[GIF:/.test(sys) && !ev.some((e: any) => e.type === 'gif'));

  await User.updateOne({ _id: gu._id }, { $set: { gifsEnabled: false } });
  ev = await chat('lol that was so funny');
  check('user switched GIFs off → none offered or sent', !/\[GIF:/.test(sys) && !ev.some((e: any) => e.type === 'gif'));
  delete process.env.GIPHY_API_KEY;

  await mongoose.disconnect(); await mongod.stop();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
