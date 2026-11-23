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
  const fake = {
    stream: () => (async function* () { yield 'x'; })(),
    complete: async (_m: string, _k: number, msgs: any[]) => { lastSystem = String(msgs[0]?.content || ''); return next; },
  };
  llm._setAdaptersForTest({ groq: fake, gemini: fake }, { groq: 1, gemini: 1 });

  // ---------------- tone rules in the prompt ----------------
  const prompt = buildCompanionPrompt({ persona: 'aastha', userName: 'Sanjith', userMood: 'neutral', facts: [], timeContext: 'evening', voiceAvailable: true, nicknameLine: 'Your nickname for them is "Sanju-bhai".' });
  check('prompt bans assistant filler + emoji stacking, handles "cringe" without apologising', /Sound like a person/.test(prompt) && /I'm all ears/.test(prompt) && /don't apologise/i.test(prompt) && /none or one per message/.test(prompt));
  check('nickname line reaches the prompt', prompt.includes('Sanju-bhai'));

  // ---------------- reply chips: user's voice ----------------
  next = JSON.stringify({ replies: ['haha fair', "I'm all ears", 'My bad, let me try again', 'tell me something real', 'haha fair'] });
  const chips = await extras.suggestReplies({ botName: 'Aastha', userText: 'cringe', reply: 'Okay fine, that was a bit much. What do you actually do for fun?' });
  check('chips come from the reply, deduped, companion-voice lines dropped', JSON.stringify(chips) === JSON.stringify(['haha fair', 'tell me something real']), chips);
  check('chip prompt tells the model to write AS the user', /Written BY the user/.test(lastSystem) && /Never write as Aastha/.test(lastSystem));
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
  const many = Array.from({ length: 6 }, (_, i) => ({ user: u._id, role: 'assistant', content: encrypt('x'), isNudge: true, timestamp: new Date(Date.now() - 1000 * (i + 5)) }));
  await Message.insertMany(many);
  await Message.create({ user: u._id, role: 'assistant', content: encrypt('anyway'), timestamp: new Date(Date.now() + 2000) });
  r = await call(chat.sendNudge, { reason: 'seen' });
  check('daily cap (6) respected', r.statusCode === 204);

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
