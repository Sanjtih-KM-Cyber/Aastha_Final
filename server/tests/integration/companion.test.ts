/* Companion polish (2026-11-23): reply chips in the USER's voice, Bestie nicknames, follow-up nudges, tone rules.
   In-memory MongoDB + a fake LLM. */
process.env.SERVER_ENCRYPTION_KEY = 'companion-key';
process.env.JWT_SECRET = 'x';
delete process.env.RESEND_API_KEY;
const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 400));
  if (!cond) failures++;
};
const mockRes = () => {
  const r: any = { statusCode: 200, body: null, ended: false };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.end = () => { r.ended = true; return r; };
  return r;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const Message = require(`${SRV}/models/Message`).default;
  const { encrypt } = require(`${SRV}/utils/serverEncryption`);
  const llm = require(`${SRV}/services/llm`);
  const extras = require(`${SRV}/services/companionExtras`);
  const chat = require(`${SRV}/controllers/chatController`);
  const me = require(`${SRV}/controllers/meController`);
  const { buildCompanionPrompt } = require(`${SRV}/prompts/companion`);

  let next = '';                 // what the fake model answers
  let lastSystem = '';
  let lastMsgs: any[] = [];
  const fake = {
    stream: () => (async function* () { yield 'x'; })(),
    complete: async (_m: string, _k: number, msgs: any[]) => { lastSystem = String(msgs[0]?.content || ''); lastMsgs = msgs; return next; },
  };
  llm._setAdaptersForTest({ groq: fake, gemini: fake }, { groq: 1, gemini: 1 });

  // ---------------- tone rules in the prompt ----------------
  const prompt = buildCompanionPrompt({ persona: 'aastha', userName: 'Sanjith', userMood: 'neutral', facts: [], timeContext: 'evening', voiceAvailable: true, nicknameLine: 'Your nickname for them is "Sanju-bhai".' });
  check('prompt: texting guide with examples, bans filler + em dashes, length follows the moment, never apologise for "cringe"', /# How you text/.test(prompt) && /I'm all ears/.test(prompt) && /Never apologise/.test(prompt) && /never more than one/.test(prompt) && /Length follows the moment/.test(prompt) && /my dad passed away/.test(prompt) && !prompt.includes('—'));
  check('nickname line reaches the prompt', prompt.includes('Sanju-bhai'));

  // ---------------- reply chips: user's voice ----------------
  next = JSON.stringify({ replies: ['haha fair', "I'm all ears", 'My bad, let me try again', 'tell me something real', 'haha fair'] });
  const chips = await extras.suggestReplies({ botName: 'Aastha', userText: 'cringe', reply: 'Okay fine, that was a bit much. What do you actually do for fun?' });
  check('chips come from the reply, deduped, companion-voice lines dropped', JSON.stringify(chips) === JSON.stringify(['haha fair', 'tell me something real']), chips);
  check('chip prompt: model plays the USER, with examples', /You are the person texting Aastha/.test(lastSystem) && /never comfort/.test(lastSystem) && /netflix obviously/.test(lastSystem));
  const swapped = lastMsgs.filter((m: any) => m.role !== 'system');
  check("chips: roles swapped (Aastha's reply arrives as the other person, the user's text as the model's own)",
    swapped.some((m: any) => m.role === 'user' && /What do you actually do for fun/.test(m.content)) && swapped.some((m: any) => m.role === 'assistant' && m.content === 'cringe'), swapped);
  next = JSON.stringify({ replies: ['how are you feeling about it?', "I'm sorry to hear that", 'netflix obviously'] });
  check('chips: companion-voice lines dropped', JSON.stringify(await extras.suggestReplies({ botName: 'Aastha', userText: 'idk', reply: 'laundry or netflix?' })) === JSON.stringify(['netflix obviously']));
  next = 'not json at all';
  check('bad model output → no chips (no crash)', (await extras.suggestReplies({ botName: 'Aastha', userText: 'hi', reply: 'hey' })).length === 0);

  // ---------------- nicknames ----------------
  check('generic / junk nicknames rejected', !extras.isOkNickname('buddy') && !extras.isOkNickname('x') && !extras.isOkNickname('Sanj123') && extras.isOkNickname('Sanju-bhai'));
  next = JSON.stringify({ nickname: 'Sanju-bhai' });
  check('nickname made from their name', (await extras.makeNickname({ name: 'Sanjith K M', facts: ['loves chai'], persona: 'aastha' })) === 'Sanju-bhai');
  check('"another one" never repeats the current one', (await extras.makeNickname({ name: 'Sanjith', facts: [], persona: 'aastha', avoid: ['Sanju-bhai'] })) === null);

  const u = await User.create({ name: 'Sanjith', emailEncrypted: encrypt('s@x.com'), passwordHash: 'x', isVerified: true, bond: { points: 800, level: 4 } });
  const call = async (fn: any, body: any = {}) => { const res = mockRes(); await fn({ user: u, body, params: {}, query: {} } as any, res); return res; };
  next = JSON.stringify({ nickname: 'Jithu' });
  let r = await call(me.updateNickname, { action: 'regenerate' });
  const raw = await mongoose.connection.db.collection('users').findOne({ _id: u._id });
  check('Bestie: "another one" gives a new nickname, stored encrypted', r.statusCode === 200 && r.body.nickname.value === 'Jithu' && raw.nickname.value !== 'Jithu' && String(raw.nickname.value).startsWith('v2:'), { b: r.body, raw: raw.nickname });
  r = await call(me.updateNickname, { action: 'set', value: 'Captain Chai' });
  check('user can choose their own', r.statusCode === 200 && r.body.nickname.value === 'Captain Chai' && r.body.nickname.by === 'user');
  r = await call(me.updateNickname, { action: 'set', value: '<script>' });
  check('junk custom nickname refused', r.statusCode === 400);
  r = await call(me.updateNickname, { action: 'off' });
  check('can turn it off', r.statusCode === 200 && r.body.nickname.off === true);
  const low = await User.create({ name: 'New', emailEncrypted: encrypt('n@x.com'), passwordHash: 'x', isVerified: true, bond: { points: 10, level: 0 } });
  const rLow = mockRes(); await me.updateNickname({ user: low, body: { action: 'regenerate' }, params: {}, query: {} } as any, rLow);
  check('locked below Bestie', rLow.statusCode === 400);

  // ---------------- follow-up nudge ----------------
  const [m1, m2] = await Message.insertMany([
    { user: u._id, role: 'user', content: encrypt('what kind of fun'), timestamp: new Date(Date.now() - 60_000) },
    { user: u._id, role: 'assistant', content: encrypt('Road trip to Gokarna, obviously.'), timestamp: new Date(Date.now() - 30_000), userReaction: '😑' },
  ]);
  next = 'okay that face says a lot 😅 too basic?';
  r = await call(chat.sendNudge, { reason: 'reaction', messageId: String(m2._id) });
  check('reaction + quiet → one follow-up, saved as a nudge', r.statusCode === 200 && r.body.content === next && (await Message.countDocuments({ user: u._id, isNudge: true })) === 1, r.body);
  check('nudge prompt knows the reaction', lastSystem.includes('😑') && /landed wrong/.test(lastSystem));
  r = await call(chat.sendNudge, { reason: 'seen' });
  check('never two nudges in a row', r.statusCode === 204 && (await Message.countDocuments({ user: u._id, isNudge: true })) === 1);
  await Message.create({ user: u._id, role: 'user', content: encrypt('lol'), timestamp: new Date() });
  r = await call(chat.sendNudge, { reason: 'seen', messageId: String(m2._id) });
  check('no nudge once they replied', r.statusCode === 204);
  await Message.create({ user: u._id, role: 'assistant', content: encrypt('so?'), timestamp: new Date(Date.now() + 1000) });
  await User.updateOne({ _id: u._id }, { $set: { 'reachOut.lastCrisisAt': new Date() } });
  r = await call(chat.sendNudge, { reason: 'seen' });
  check('no nudges for 12 h after a crisis', r.statusCode === 204);
  await User.updateOne({ _id: u._id }, { $unset: { 'reachOut.lastCrisisAt': 1 } });

  // left on seen + app closed → prepared (not saved), notification fires, then committed (2026-11-24)
  const so = await Message.findOne({ user: u._id, role: 'assistant' }).sort({ timestamp: -1 });
  await Message.updateOne({ _id: so!._id }, { $set: { timestamp: new Date() } }); // fixture was in the future
  await new Promise(r => setTimeout(r, 5));
  next = 'you there? or did sleep win 😴';
  const nudgesBefore = await Message.countDocuments({ user: u._id, isNudge: true });
  r = await call(chat.sendNudge, { reason: 'seen', messageId: String(so!._id), deferred: true });
  const prep = r.body;
  check('deferred nudge: written but not saved yet', r.statusCode === 200 && prep.content === next && !!prep.token
    && (await Message.countDocuments({ user: u._id, isNudge: true })) === nudgesBefore, r.body);
  r = await call(chat.commitNudge, { messageId: String(so!._id), content: 'something else', preparedAt: prep.preparedAt, token: prep.token });
  check('deferred nudge: edited text is refused', r.statusCode === 400);
  r = await call(chat.commitNudge, { messageId: String(so!._id), content: prep.content, preparedAt: prep.preparedAt - 7 * 3_600_000, token: prep.token });
  check('deferred nudge: stale one is ignored', r.statusCode === 204);
  r = await call(chat.commitNudge, { messageId: String(so!._id), content: prep.content, preparedAt: prep.preparedAt, token: prep.token });
  check('deferred nudge: fired → saved in the chat once', r.statusCode === 200 && (await Message.countDocuments({ user: u._id, isNudge: true })) === nudgesBefore + 1);
  r = await call(chat.commitNudge, { messageId: String(so!._id), content: prep.content, preparedAt: prep.preparedAt, token: prep.token });
  check('deferred nudge: never saved twice', r.statusCode === 204);

  const many = Array.from({ length: 6 }, (_, i) => ({ user: u._id, role: 'assistant', content: encrypt('x'), isNudge: true, timestamp: new Date(Date.now() - 1000 * (i + 5)) }));
  await Message.insertMany(many);
  await Message.create({ user: u._id, role: 'assistant', content: encrypt('anyway'), timestamp: new Date(Date.now() + 2000) });
  r = await call(chat.sendNudge, { reason: 'seen' });
  check('daily cap (6) respected', r.statusCode === 204);

  // ---------------- app lock: unlock with the account password ----------------
  const bcrypt = require('bcryptjs');
  const pw = await User.create({ name: 'Lock', emailEncrypted: encrypt('l@x.com'), passwordHash: await bcrypt.hash('right-pass', 4), isVerified: true });
  const vp = async (password: string) => { const res = mockRes(); await me.verifyAccountPassword({ user: pw, body: { password }, params: {}, query: {} } as any, res); return res.statusCode; };
  check('lock screen: right password unlocks', (await vp('right-pass')) === 200);
  check('lock screen: wrong password refused with 422 (not 401 — that would sign the user out)', (await vp('nope')) === 422);
  for (let k = 0; k < 4; k++) await vp('nope');
  check('lock screen: 5 wrong tries → cool-down (even the right one waits)', (await vp('right-pass')) === 429);
  me._resetUnlockLimiter();

  // ---------------- start fresh: the user picks what to reset (2026-11-24) ----------------
  const VoiceNote = require('../../src/models/VoiceNote').default;
  await User.updateOne({ _id: pw._id }, { $set: { bond: { points: 500, level: 4, override: 3 }, nickname: { value: encrypt('Chotu') }, facts: [encrypt('likes chai')], memorySummary: encrypt('summary'), diaryPassword: 'keep' } });
  await Message.insertMany([{ user: pw._id, role: 'user', content: encrypt('hi'), timestamp: new Date() }, { user: pw._id, role: 'assistant', content: encrypt('hey'), timestamp: new Date() }]);
  await VoiceNote.create({ _id: 'vn-fresh-1', user: pw._id, buffer: Buffer.from('x'), mimeType: 'audio/wav' }).catch(() => {});
  const fs = async (body: any) => { const res = mockRes(); await me.freshStart({ user: pw, body, params: {}, query: {} } as any, res); return res; };
  check('fresh start: must pick something', (await fs({})).statusCode === 400);
  r = await fs({ closeness: true });
  let fresh: any = await User.findById(pw._id).lean();
  check('fresh start: closeness alone needs no password, back to New friend, nickname gone, memories kept',
    r.statusCode === 200 && fresh.bond.points === 0 && fresh.bond.override === null && !fresh.nickname?.value && fresh.facts.length === 1, fresh.bond);
  check('fresh start: memories need the password (422, never 401)', (await fs({ memories: true, password: 'nope' })).statusCode === 422);
  r = await fs({ memories: true, password: 'right-pass' });
  fresh = await User.findById(pw._id).lean();
  check('fresh start: memories wiped, chats kept', r.statusCode === 200 && fresh.facts.length === 0 && !fresh.memorySummary && (await Message.countDocuments({ user: pw._id })) === 2);
  r = await fs({ chats: true, password: 'right-pass' });
  check('fresh start: chats + voice notes deleted', r.statusCode === 200 && (await Message.countDocuments({ user: pw._id })) === 0 && (await VoiceNote.countDocuments({ user: pw._id })) === 0);
  check('fresh start: account itself untouched', !!(await User.findById(pw._id)));
  me._resetUnlockLimiter();

  // ---------------- Sarvam voice notes (2026-11-24) ----------------
  const sv = require('../../src/services/sarvamTts');
  check('sarvam: Hinglish in English letters → Indian English', sv.languageFor('arre yaar kya scene hai aaj') === 'en-IN');
  check('sarvam: Devanagari → hi-IN, or mr-IN when they chose Marathi', sv.languageFor('आज कैसा रहा दिन?') === 'hi-IN' && sv.languageFor('आज कसा होता दिवस?', 'marathi') === 'mr-IN');
  check('sarvam: Tamil / Bengali / Telugu scripts', sv.languageFor('எப்படி இருக்கீங்க') === 'ta-IN' && sv.languageFor('কেমন আছো') === 'bn-IN' && sv.languageFor('ఎలా ఉన్నావు') === 'te-IN');
  const long = 'This is a sentence. '.repeat(200);
  check('sarvam: long text cut at a sentence end, ≤ 2500 chars', sv.trimForTts(long).length <= 2500 && sv.trimForTts(long).endsWith('.'));
  const axios = require('axios');
  const realPost = axios.post;
  let sent: any = null, hdr: any = null;
  axios.post = async (_u: string, body: any, cfg: any) => { sent = body; hdr = cfg.headers; return { status: 200, data: { audios: [Buffer.alloc(400, 1).toString('base64')] } }; };
  delete process.env.SARVAM_API_KEY;
  check('sarvam: off without a key', (await sv.sarvamSpeak('hi there', 'aastha')) === null && sent === null);
  process.env.SARVAM_API_KEY = 'test-key';
  const audio = await sv.sarvamSpeak('so proud of you, seriously', 'aastik', { description: 'soft and gentle' });
  check('sarvam: sends text + persona voice + pace, key in header', !!audio && audio.length === 400 && sent.speaker === 'rohan' && sent.language_code === 'en-IN' && sent.pace === 0.92 && hdr['api-subscription-key'] === 'test-key', sent);
  axios.post = async () => ({ status: 402, data: { error: { code: 'insufficient_quota_error' } } });
  check('sarvam: out of credits → null (caller falls back to the HF Space)', (await sv.sarvamSpeak('hello', 'aastha')) === null);
  axios.post = realPost;
  delete process.env.SARVAM_API_KEY;

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
