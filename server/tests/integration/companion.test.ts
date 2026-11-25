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

  // ---------------- What Aastha remembers (2026-11-24) ----------------
  const memSvc = require(`${SRV}/services/memoryService`);
  const mu = await User.create({ name: 'Mem', emailEncrypted: encrypt('m@x.com'), passwordHash: 'x', isVerified: true,
    facts: [encrypt('Loves chai'), encrypt('Has exams in March'), encrypt('Sister is called Riya')], memorySummary: encrypt('Busy with exams lately.'),
    followUps: [{ text: encrypt('your exam'), dueDate: new Date(Date.now() + 86_400_000), status: 'pending' }] });
  const mcall = async (fn: any, body: any = {}, params: any = {}) => { const res = mockRes(); await fn({ user: mu, body, params, query: {} } as any, res); return res; };
  r = await mcall(me.getMemory);
  check('memory: facts, summary and follow-ups come back readable', r.body?.facts?.length === 3 && r.body.facts[0].text === 'Loves chai' && r.body.summary === 'Busy with exams lately.' && r.body.followUps[0]?.text === 'your exam', r.body);
  r = await mcall(me.editMemoryFact, { index: 1, original: 'Has exams in March', text: 'Has exams in April' });
  check('memory: edit a fact', r.statusCode === 200 && r.body.facts[1].text === 'Has exams in April');
  r = await mcall(me.editMemoryFact, { index: 0, original: 'Something else', text: '' });
  check('memory: stale edit (list changed) → 409, nothing deleted', r.statusCode === 409 && (await User.findById(mu._id)).facts.length === 3);
  r = await mcall(me.editMemoryFact, { index: 0, original: 'Loves chai', text: '' });
  check('memory: delete a fact', r.statusCode === 200 && r.body.facts.length === 2 && !r.body.facts.some((f: any) => /chai/i.test(f.text)));
  next = JSON.stringify({ summary: 'Busy with exams.', new_facts: ['loves chai.', 'Plays guitar'], outdated_facts: [] });
  await memSvc.updateMemory(String(mu._id), [{ role: 'user', content: 'I love chai and I play guitar' }]);
  let memNow = (await mcall(me.getMemory)).body;
  check('memory: a deleted fact is never re-learned (even reworded case/punctuation), new ones still are',
    !memNow.facts.some((f: any) => /chai/i.test(f.text)) && memNow.facts.some((f: any) => f.text === 'Plays guitar'), memNow.facts);
  // the background updater started BEFORE the user's edit must not undo it
  const realComplete = fake.complete;
  let releaseModel: () => void = () => {};
  fake.complete = async (...a: any[]) => { await new Promise<void>((res) => { releaseModel = res; }); return realComplete(...(a as [string, number, any[]])); };
  next = JSON.stringify({ summary: 'Model summary', new_facts: ['Likes cricket'], outdated_facts: [] });
  const running = memSvc.updateMemory(String(mu._id), [{ role: 'user', content: 'I like cricket' }]);
  await new Promise((res) => setTimeout(res, 30));
  await mcall(me.editMemorySummary, { text: 'My own words.' });
  releaseModel(); await running;
  fake.complete = realComplete;
  memNow = (await mcall(me.getMemory)).body;
  check('memory: an edit made while she was thinking wins (summary not overwritten)', memNow.summary === 'My own words.', memNow.summary);
  r = await mcall(me.dismissMemoryFollowUp, {}, { id: String(memNow.followUps[0].id) });
  check('memory: "don\'t ask me about this" removes the check-in', r.statusCode === 200 && r.body.followUps.length === 0);
  r = await mcall(me.editMemorySummary, { text: '' });
  check('memory: summary can be cleared', r.body.summary === '');

  // ---------------- Personal notifications (2026-11-25) ----------------
  const nc = require(`${SRV}/services/notifCopy`);
  check('notif: banned filler lines rejected', nc.cleanLine('No pressure, I\'m here 💜') === null && nc.cleanLine('just checking in!') === null && nc.cleanLine('a — b') !== null && !String(nc.cleanLine('a — b')).includes('—') && nc.cleanLine('x'.repeat(120)) === null && nc.cleanLine('hi 😀😀') === null);
  const fb = nc.fallbackCopy('Sanjith', '2026-11-25', 4);
  check('notif: fallback still uses their name', [fb.morning, fb.night, ...fb.missYou].every((l: string) => /Sanjith/.test(l)) && [fb.morning, fb.night, ...fb.missYou].every((l: string) => nc.cleanLine(l) === l), fb);
  const nu = await User.create({ name: 'Sanjith K M', emailEncrypted: encrypt('n2@x.com'), passwordHash: 'x', isVerified: true, timeZone: 'Asia/Kolkata',
    facts: [encrypt('Has a maths exam on Friday'), encrypt('Plays guitar')], bond: { points: 800, level: 4 }, nickname: { value: encrypt('Sanju-bhai') } });
  next = JSON.stringify({ morning: 'morning Sanju-bhai ☀️ maths exam friday, ready?', night: 'No pressure, I\'m here for you', missYou: ['Sanju-bhai, the guitar misses you', 'where did you vanish 👀', 'two days!! update me'] });
  const nowN = new Date('2026-11-25T09:00:00+05:30');
  let copy = await nc.getNotifCopy(nu._id, nowN);
  check('notif: written by the model from real facts + nickname', copy.morning.includes('maths exam') && /Sanju-bhai/.test(lastMsgs[1]?.content || '') && /Has a maths exam/.test(lastMsgs[1]?.content || ''), copy);
  check('notif: a filler line from the model is replaced by a personal one', !/no pressure/i.test(copy.night) && /Sanju-bhai/.test(copy.night), copy.night);
  next = JSON.stringify({ morning: 'something else entirely', night: 'x', missYou: [] });
  copy = await nc.getNotifCopy(nu._id, new Date('2026-11-25T20:00:00+05:30'));
  check('notif: cached for the day (one model call per day)', copy.morning.includes('maths exam'));
  const stored: any = await User.findById(nu._id).lean();
  check('notif: cached lines encrypted at rest', stored.notifCopy?.day === '2026-11-25' && !String(stored.notifCopy?.data).includes('maths'));
  const ro2 = require(`${SRV}/services/reachOut`);
  const leanUser: any = { name: encrypt('Mira Shah'), persona: 'aastik', timeZone: 'Asia/Kolkata', reachOut: {},
    followUps: [{ _id: '64b000000000000000000001', text: encrypt('your exam'), dueDate: new Date(Date.now() - 86_400_000), status: 'pending' }] };
  const ups = ro2.upcomingCheckIns(leanUser, new Date());
  check('check-in: real first name (was ciphertext from a lean read), Aastik title', ups.length === 0 || (/Mira/.test(ups[0].body) && !/v\d:|:/.test(ups[0].body.split(' ')[0]) && ups[0].title === 'Aastik'), ups);
  check('check-in text: name + event, no "No pressure"', /Mira/.test(ro2.checkInText('Mira', 'your exam')) && !/no pressure/i.test(ro2.checkInText('Mira', 'your exam')));

  // ---------------- The Web: never the companion or the user ----------------
  const det = require(`${SRV}/services/detectiveService`);
  check('web: companion / user names filtered', det.isSelfOrCompanion('Aastha') && det.isSelfOrCompanion('aastik') && det.isSelfOrCompanion('Sanjith', 'Sanjith K M') && det.isSelfOrCompanion('Sanjith K M', 'Sanjith K M') && !det.isSelfOrCompanion('Mom', 'Sanjith K M') && !det.isSelfOrCompanion('Riya', 'Sanjith'));
  check('web: a friend with the SAME name as the user stays when the scan says it\'s someone else', !det.isSelfOrCompanion('Sanjith', 'Sanjith K M', { distinctPerson: true, role: 'friend' }));
  check('web: cousin named Aastha stays; "distinct" with no real relationship does not', !det.isSelfOrCompanion('Aastha', 'Sanjith', { distinctPerson: true, role: 'cousin' }) && det.isSelfOrCompanion('Aastha', 'Sanjith', { distinctPerson: true, role: 'other' }));
  check('web: a same-name row the user corrected by hand stays', !det.isSelfOrCompanion('Sanjith', 'Sanjith K M', { userEdited: true, role: 'best_friend' }));
  // full scan with the fake model: the user, the companion, a same-name friend and mom
  const { Person } = require(`${SRV}/models/Person`);
  const wu = await User.create({ name: 'Sanjith K M', emailEncrypted: encrypt('w@x.com'), passwordHash: 'x', isVerified: true });
  await Message.insertMany([{ user: wu._id, role: 'user', content: encrypt('my friend Sanjith from college called, and mom made biryani'), timestamp: new Date() }]);
  next = JSON.stringify({ people: [
    { name: 'Sanjith', role: 'other', vibe: 'unsure', score: 0, rapSheet: [] },                               // the user
    { name: 'Aastha', role: 'other', vibe: 'warm', score: 10, rapSheet: [] },                                 // the app
    { name: 'Sanjith', role: 'friend', vibe: 'warm', score: 40, rapSheet: ['from college'], distinctPerson: true }, // a real friend
    { name: 'Mom', role: 'parent', vibe: 'supportive', score: 80, rapSheet: ['made biryani'] },
  ] });
  await det.detectiveService.runRetroactiveScan(String(wu._id));
  const board = await det.detectiveService.getWeb(String(wu._id));
  check('web scan: friend Sanjith + Mom on the board, the user and the app not', board.length === 2 && board.some((x: any) => x.name === 'Sanjith' && x.role === 'friend') && board.some((x: any) => x.name === 'Mom'), board.map((x: any) => `${x.name}/${x.role}`));
  check('web scan: the model is told the user\'s own name', /The user's own name: Sanjith K M/.test(lastMsgs[1]?.content || ''));
  await Person.create({ userId: wu._id, name: encrypt('Aastha'), nameHash: require(`${SRV}/utils/serverEncryption`).blindIndex('Aastha'), role: 'other', relationshipScore: 0 });
  const board2 = await det.detectiveService.getWeb(String(wu._id));
  check('web: an old "Aastha · Someone" row from earlier scans is cleaned up, real people kept', board2.length === 2 && !board2.some((x: any) => x.name === 'Aastha'), board2.map((x: any) => x.name));

  // ---------------- Time sense: gaps between messages (2026-11-24) ----------------
  const tg = require(`${SRV}/services/timeGap`);
  const g0 = tg.describeGap(new Date('2026-11-24T21:50:00+05:30'), new Date('2026-11-24T22:02:00+05:30'), 'Asia/Kolkata');
  check('gap: 12 minutes = same conversation, no note', !g0.line && !g0.trim);
  const g1 = tg.describeGap(new Date('2026-11-24T20:30:00+05:30'), new Date('2026-11-24T22:02:00+05:30'), 'Asia/Kolkata');
  check('gap: ~1.5 h = short break, thread can continue', /short break/.test(g1.line) && !g1.trim);
  const g2 = tg.describeGap(new Date('2026-11-24T08:10:00+05:30'), new Date('2026-11-24T22:02:00+05:30'), 'Asia/Kolkata');
  check('gap: morning → 10 pm = new moment (the owner\'s case), old thread trimmed', /14 hours/.test(g2.line) && /this morning/.test(g2.line) && /night now/.test(g2.line) && /NEW moment/.test(g2.line) && /just woke up/.test(g2.line) && g2.trim, g2.line);
  const g3 = tg.describeGap(new Date('2026-11-23T23:30:00+05:30'), new Date('2026-11-24T09:00:00+05:30'), 'Asia/Kolkata');
  check('gap: last night → this morning says "yesterday night"', /yesterday night/.test(g3.line) && /morning now/.test(g3.line), g3.line);
  check('gap: in the companion prompt under "Right now"', buildCompanionPrompt({ persona: 'aastha', userName: 'S', userMood: 'neutral', facts: [], timeContext: 'Tuesday 10:02 pm', voiceAvailable: false, gapLine: g2.line }).includes(`- ${g2.line}\n`));
  check('gap: no stray line when there is no gap', !buildCompanionPrompt({ persona: 'aastha', userName: 'S', userMood: 'neutral', facts: [], timeContext: 'x', voiceAvailable: false }).includes('{{gapLine}}'));

  // ---------------- Weekly letter (2026-11-24) ----------------
  const wl = require(`${SRV}/services/weeklyLetter`);
  const IST = 'Asia/Kolkata';
  const at = (s: string) => new Date(s);
  check('letter: due from Sunday 18:00 their time', wl.dueSunday(at('2026-11-29T17:59:00+05:30'), IST) === null && wl.dueSunday(at('2026-11-29T18:00:00+05:30'), IST) === '2026-11-29');
  check('letter: still due Mon to Wed (server was asleep), not Thursday', wl.dueSunday(at('2026-12-02T09:00:00+05:30'), IST) === '2026-11-29' && wl.dueSunday(at('2026-12-03T09:00:00+05:30'), IST) === null);
  check('letter: follows their own time zone', wl.dueSunday(at('2026-11-29T18:30:00+05:30'), 'Europe/London') === null);
  const lu = await User.create({ name: 'Letter', emailEncrypted: encrypt('l2@x.com'), passwordHash: 'x', isVerified: true, timeZone: IST, persona: 'aastha',
    memorySummary: encrypt('Exam week, nervous about maths.'), facts: [encrypt('Plays guitar')] });
  const sundayEve = at('2026-11-29T19:00:00+05:30');
  const inWeek = (h: number) => new Date(at('2026-11-26T10:00:00+05:30').getTime() + h * 3_600_000);
  await Message.insertMany([0, 1, 2].map((h) => ({ user: lu._id, role: 'user', content: encrypt(`msg ${h}`), timestamp: inWeek(h) })));
  let lr = await wl.maybeWriteLetter(lu._id, sundayEve);
  check('letter: not after a quiet week (< 5 messages)', !lr.letter && lr.reason === 'quiet_week', lr);
  await Message.insertMany([3, 4, 5].map((h) => ({ user: lu._id, role: 'user', content: encrypt(h === 4 ? 'maths exam went okay actually' : `msg ${h}`), timestamp: inWeek(h) })));
  await User.updateOne({ _id: lu._id }, { $set: { 'reachOut.lastCrisisAt': new Date(sundayEve.getTime() - 3_600_000) } });
  lr = await wl.maybeWriteLetter(lu._id, sundayEve);
  check('letter: none within 48 h of a crisis', !lr.letter && lr.reason === 'crisis');
  await User.updateOne({ _id: lu._id }, { $unset: { 'reachOut.lastCrisisAt': 1 } });
  next = 'Hey Letter,\n\nThat maths exam — you were so nervous and then "okay actually". Proud of you.\n\nAastha';
  const [l1, l2] = await Promise.all([wl.maybeWriteLetter(lu._id, sundayEve), wl.maybeWriteLetter(lu._id, sundayEve)]);
  const letters = await Message.countDocuments({ user: lu._id, isLetter: true });
  check('letter: written once even if the cron and the app ask at the same time', letters === 1 && [l1, l2].filter((x: any) => x.letter).length === 1, [l1.reason, l2.reason]);
  const written = (l1.letter || l2.letter);
  check('letter: from the week\'s real messages, persona voice, no em dashes', /maths exam went okay actually/.test(lastMsgs[1]?.content || '') && /Exam week/.test(lastMsgs[1]?.content || '') && !written.content.includes('—') && /Aastha$/.test(written.content), written.content);
  lr = await wl.maybeWriteLetter(lu._id, at('2026-11-30T10:00:00+05:30'));
  check('letter: not again on Monday', !lr.letter && lr.reason === 'already');
  const lres = mockRes(); lres.setHeader = () => lres; await chat.getChatHistory({ user: lu, query: {}, params: {} } as any, lres);
  check('letter: shows in chat history as a letter', Array.isArray(lres.body) && lres.body.some((m: any) => m.isLetter && /Proud of you/.test(m.content)), lres.body?.slice?.(-1));
  const nres = mockRes(); await chat.sendNudge({ user: lu, body: { reason: 'seen' } } as any, nres);
  check('letter: no "you there?" nudge after a letter', nres.statusCode === 204);
  await User.updateOne({ _id: lu._id }, { $set: { 'weeklyLetter.enabled': false }, $unset: { 'weeklyLetter.lastWeek': 1 } });
  lr = await wl.maybeWriteLetter(lu._id, sundayEve);
  check('letter: off switch respected', !lr.letter && lr.reason === 'off');

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
