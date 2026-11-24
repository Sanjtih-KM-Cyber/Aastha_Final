/* Phase 3: relationship engine, crisis detection, prompt assembly, and END-TO-END chatController SSE
   (in-memory MongoDB + fake LLM providers). */
process.env.SERVER_ENCRYPTION_KEY = 'k';
process.env.JWT_SECRET = 'x';
process.env.AI_CHAT_MODELS = 'chatA';
process.env.AI_THINK_MODELS = 'thinkA';
process.env.AI_BRAIN_MODELS = 'brainA';
process.env.AI_GEMINI_FALLBACK_MODEL = 'gem';
process.env.BRAIN_SERVER_URL = 'http://127.0.0.1:9'; // unreachable → no voice notes

const SRV = require('path').resolve(__dirname, '../../src');
const NM = require('path').resolve(__dirname, '../../node_modules');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require(`${NM}/mongoose`);

const rel = require(`${SRV}/services/relationship`);
const { assessRisk } = require(`${SRV}/utils/safety`);
const { buildCompanionPrompt, describeLanguage } = require(`${SRV}/prompts/companion`);
const llm = require(`${SRV}/services/llm`);

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 400));
  if (!cond) failures++;
};

(async () => {
  // ---------------- Style mirroring ----------------
  let st: any;
  for (const m of ['hii', 'kya kar rahi ho yaar', 'lol same 😂😂', 'idk bas thak gayi', 'hmm ok']) st = rel.updateStyle(st, m);
  const line = rel.describeStyle(st);
  check('style: short lowercase Hinglish emoji user detected', /very short/.test(line) && /lowercase/.test(line) && /Hinglish/.test(line) && /shorthand/.test(line), line);
  let formal: any;
  for (const m of ['Good evening. I wanted to talk about something that has been bothering me at work for a few weeks now, and I would appreciate your perspective on how to handle a difficult conversation with my manager.', 'Thank you. That is helpful, although I am still unsure about the timing and whether I should involve HR at this stage of the process or wait until after the review cycle.', 'I think I will wait until the review. I appreciate it.'])
    formal = rel.updateStyle(formal, m);
  const fline = rel.describeStyle(formal);
  check('style: formal user not told to use Hinglish/lowercase/emojis', !/Hinglish|lowercase|use them freely/.test(fline) && /rarely use emojis/.test(fline), fline);
  check('style: no instruction before 3 samples', rel.describeStyle(rel.updateStyle(undefined, 'hi')) === '');

  // ---------------- Bond levels ----------------
  const day = (d: number, h = 6) => new Date(Date.UTC(2026, 0, d, h));
  let b: any = undefined;
  let r = rel.updateBond(b, 'hello', day(1)); b = r.state;
  check('bond: first message = new-day bonus + 1 point', b.points === 5 && b.level === 0, b);
  for (let i = 0; i < 100; i++) b = rel.updateBond(b, 'spam', day(1)).state;
  check('bond: daily cap stops spam farming (30 msgs/day)', b.points === 4 + 30, b.points);
  let ups = 0;
  for (let d = 2; d <= 30; d++) for (let i = 0; i < 10; i++) { r = rel.updateBond(b, 'a normal message', day(d)); b = r.state; if (r.leveledUp) ups++; }
  check('bond: a month of daily chatting reaches Friend+', b.level >= 2, b);
  check('bond: level-ups were reported', ups >= 2, ups);
  const before = b.points;
  r = rel.updateBond(b, 'back!', day(30 + 14 + 28));
  check('bond: fades after weeks away but not below previous level floor', r.state.points < before + 5 && r.state.points >= rel.BOND_LEVELS[Math.max(0, b.level - 1)].min, { before, after: r.state.points });
  check('bond: override wins', rel.effectiveLevel({ points: 0, override: 4 }) === 4 && rel.effectiveLevel({ points: 999, override: 0 }) === 0);
  check('bond: level-up note only when growing naturally', /just become closer/.test(rel.bondPromptLine({ points: 120, override: null }, true)) && !/just become closer/.test(rel.bondPromptLine({ points: 120, override: 2 }, true)));
  check('bond: stranger card forbids nicknames', /no nicknames/.test(rel.bondPromptLine({ points: 0 }, false)));
  check('bond: every level keeps the same voice (no "polite", no toning down)', [0, 1, 2, 3, 4].every((o) => {
    const line = rel.bondPromptLine({ points: 0, override: o }, false);
    return !/polite|light on emojis/i.test(line) && (o === 4 || /same voice|fully yourself/i.test(line));
  }));
  b = undefined;
  for (let d = 1; d <= 21; d++) for (let i = 0; i < 15; i++) b = rel.updateBond(b, 'a normal message', day(d)).state;
  check('bond: three weeks of regular chatting reaches Bestie', b.level === 4, b);

  // ---------------- Crisis detection ----------------
  const crisis = ['I want to die', 'honestly kms', 'i dont want to live anymore', 'everyone would be better off without me', 'mujhe marna chahti hu', 'मैं मरना चाहता हूँ', 'thinking about suicide'];
  const concern = ['I feel so hopeless', 'nobody cares about me', 'i hate myself'];
  const safe = ["I'm dying to see that movie", 'dying of laughter 😂', 'you killed it today!', "I'm dead tired", 'this exam is killing me lol'];
  check('crisis phrases detected (EN, Hinglish, Hindi)', crisis.every(t => assessRisk(t) === 'crisis'), crisis.map(t => [t, assessRisk(t)]));
  check('concern phrases detected', concern.every(t => assessRisk(t) === 'concern'), concern.map(t => [t, assessRisk(t)]));
  check('common false positives NOT flagged', safe.every(t => assessRisk(t) === 'none'), safe.map(t => [t, assessRisk(t)]));

  // ---------------- Prompt assembly ----------------
  const p = buildCompanionPrompt({ persona: 'aastha', userName: 'A', userMood: 'sad', facts: [], timeContext: 'x', voiceAvailable: true,
    styleLine: 'Their texting style: casual.', bondLine: rel.bondPromptLine({ points: 800 }, false), languageLine: describeLanguage('marathi', 'Pune'),
    safetyBlock: '\n# SAFETY — test', thinking: true });
  check('prompt: bond, style, language, region present', p.includes('Bestie') && p.includes('casual') && p.includes('Marathi') && p.includes('Pune'));
  check('prompt: safety block is the LAST section', p.trimEnd().endsWith('# SAFETY — test'));
  check('prompt: thinking section present', p.includes('# Thinking it through'));

  // ---------------- END-TO-END chatController ----------------
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const Message = require(`${SRV}/models/Message`).default;
  const { chatWithAI } = require(`${SRV}/controllers/chatController`);
  const { encrypt } = require(`${SRV}/utils/serverEncryption`);

  const mkUser = async (extra: any = {}) => User.create({
    name: 'Bitto', username: 'bitto' + Math.random().toString(36).slice(2, 7), dateOfBirth: new Date('2004-01-01'),
    emailEncrypted: encrypt(Math.random() + '@x.com'), passwordHash: 'x', isVerified: true, ...extra,
  });
  const run = async (user: any, body: any) => {
    const writes: string[] = [];
    const res: any = { headersSent: true, setHeader() {}, write(c: string) { writes.push(c); return true; }, end() {}, status() { return res; }, json(b: any) { writes.push('JSON:' + JSON.stringify(b)); } };
    await chatWithAI({ user, body } as any, res);
    const events = writes.filter(w => w.startsWith('data: ') && !w.includes('[DONE]')).map(w => { try { return JSON.parse(w.slice(6)); } catch { return w; } });
    const text = events.filter((e: any) => e && e.content && !e.type).map((e: any) => e.content).join('');
    return { writes, events, text };
  };
  let lastPrompt = '';
  const setProviders = (reply: (task: string) => AsyncGenerator<any>, failAll = false) => {
    llm._health.reset();
    const fake = (provider: string) => ({
      stream: (model: string, _k: number, msgs: any[]) => { lastPrompt = msgs[0].content; if (failAll) return (async function* () { throw Object.assign(new Error('down'), { status: 503 }); })(); return reply(model); },
      complete: async (model: string) => { if (failAll) throw Object.assign(new Error('down'), { status: 503 }); return model === 'brainA' ? '{"mood":"sad","strategy":"reply","reaction":"🫂","suggested_replies":[]}' : '{}'; },
    });
    llm._setAdaptersForTest({ groq: fake('groq'), gemini: fake('gemini') }, { groq: 1, gemini: 1 });
  };

  // E2E-1: crisis with all AI down → helplines still reach the user
  const u1 = await mkUser();
  setProviders(async function* () { yield 'unused'; }, true);
  const c1 = await run(u1, { message: 'i want to die' });
  check('E2E crisis: first event is a safety event with helplines', c1.events[0]?.type === 'safety' && c1.events[0].level === 'crisis' && c1.events[0].helplines.some((h: any) => h.number === '14416'), c1.events[0]);
  check('E2E crisis + total AI outage: fallback text with helplines streamed as SSE', c1.text.includes('14416') && c1.text.includes('Are you safe'), c1.text);
  check('E2E crisis: never answered with raw JSON (old silent-drop bug)', !c1.writes.some(w => w.startsWith('JSON:')));
  check('E2E crisis: reply saved to history', (await Message.countDocuments({ user: u1._id })) === 2);

  // E2E-2: crisis with AI up → model reply streamed, safety prompt last, no voice tags requested
  setProviders(async function* () { yield "I'm really glad you told me. Are you safe right now?"; });
  const c2 = await run(u1, { message: 'i want to die' });
  check('E2E crisis (AI up): model reply streamed', c2.text.startsWith("I'm really glad you told me"), c2.text);
  check('E2E crisis: safety section is last in prompt, voice-tag instructions omitted', lastPrompt.includes('# SAFETY') && !lastPrompt.includes('[Voice output]') && lastPrompt.trimEnd().endsWith('no voice-tag/proposal tags.'), lastPrompt.slice(-200));

  // E2E-3: normal chat → style + bond persisted, tags hidden, prompt carries relationship
  const u2 = await mkUser({ preferredLanguage: 'hinglish', region: 'Pune' });
  setProviders(async function* () { yield 'haan yaar, sab theek hoga '; yield '[STYLE: warm][TTS: हाँ यार]'; });
  for (const m of ['hii', 'kya haal hai', 'bas thak gayi yaar 😩', 'office mein bohot kaam']) await run(await User.findById(u2._id), { message: m });
  const n3 = await run(await User.findById(u2._id), { message: 'aur tum?' });
  const fresh = await User.findById(u2._id).lean();
  check('E2E normal: voice tags never reach the client', n3.text.trim() === 'haan yaar, sab theek hoga' && !n3.text.includes('[TTS'), n3.text);
  check('E2E normal: style profile learned + saved', fresh.styleProfile?.samples === 5 && fresh.styleProfile.hinglish > 0.3, fresh.styleProfile);
  check('E2E normal: bond points saved', fresh.bond?.points > 0, fresh.bond);
  check('E2E normal: prompt has language, region and style lines', lastPrompt.includes('Hinglish') && lastPrompt.includes('Pune') && lastPrompt.includes('Their texting style'), lastPrompt.slice(0, 50));

  // E2E-4: dilemma → think mode, reasoning sent separately, not in reply
  const u3 = await mkUser();
  llm._health.reset();
  llm._setAdaptersForTest({
    groq: {
      stream: (model: string, _k: number, msgs: any[]) => { lastPrompt = msgs[0].content; return (async function* () { if (model === 'thinkA') { yield { reasoning: 'weighing options...' }; } yield `[${model}] go for it`; })(); },
      complete: async () => '{"mood":"neutral","strategy":"reply"}',
    },
  }, { groq: 1, gemini: 0 });
  const t1 = await run(u3, { message: 'should i take the job in bangalore or stay?' });
  const types = t1.events.map((e: any) => e.type).filter(Boolean);
  check('E2E think: dilemma routed to reasoning model', t1.text === '[thinkA] go for it', t1.text);
  check('E2E think: reasoning sent as separate events, never in reply text', types.includes('thinking_start') && types.includes('reasoning') && types.includes('thinking_end') && !t1.text.includes('weighing'), types);
  const t2 = await run(u3, { message: 'lol ok' });
  check('E2E think: casual message uses normal chat model', t2.text === '[chatA] go for it', t2.text);

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
