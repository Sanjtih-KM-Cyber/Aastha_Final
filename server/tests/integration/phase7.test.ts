/* Phase 7: credits pill count, crash-report scrubbing, reactions, user voice notes, follow-up check-ins,
   mood insights, data export. In-memory MongoDB + fake LLM providers. */
process.env.SERVER_ENCRYPTION_KEY = 'phase7-key';
process.env.JWT_SECRET = 'x';
process.env.AI_CHAT_MODELS = 'chatA';
process.env.AI_VISION_MODELS = 'visionA';
process.env.AI_BRAIN_MODELS = 'brainA';
process.env.AI_THINK_MODELS = 'thinkA';
process.env.AI_GEMINI_FALLBACK_MODEL = 'gem';
delete process.env.RESEND_API_KEY;
delete process.env.SENTRY_DSN;
const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 400));
  if (!cond) failures++;
};
const mockRes = () => {
  const r: any = { statusCode: 200, body: null, headers: {} as any, chunks: [] as any[] };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: any) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b?: any) => { if (b) r.chunks.push(b); return r; };
  return r;
};
const IST = (iso: string) => new Date(new Date(iso).getTime() - 330 * 60_000); // "2026-11-22T10:00" IST → UTC instant

(async () => {
  // ---------------- pure: scrubbing ----------------
  const { scrubText, scrubEvent } = require(`${SRV}/utils/scrub`);
  const dirty = 'mail a@b.com call +91 98765 43210 token eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMzQ1Njc4In0.abcdefghijklmnop Bearer abc.def';
  const clean = scrubText(dirty);
  check('scrub: emails, phone numbers, JWTs, bearer tokens removed', !/a@b\.com|98765|eyJ|abc\.def/.test(clean), clean);
  const ev = scrubEvent({
    message: 'failed for x@y.in',
    request: { url: 'https://api/x?token=1', data: '{"message":"i feel sad"}', cookies: { jwt: 'z' }, headers: { authorization: 'Bearer q', cookie: 'c', 'user-agent': 'UA' } },
    user: { id: 'u1', email: 'x@y.in', ip_address: '1.2.3.4' },
    extra: { body: 'secret' },
    breadcrumbs: [{ category: 'console', message: 'user said i feel sad' }, { category: 'fetch', data: { url: '/api/chat?x=1', method: 'POST', status_code: 500, body: 'hi' } }],
    exception: { values: [{ value: 'boom a@b.com', stacktrace: { frames: [{ vars: { message: 'private' } }] } }] },
  });
  check('scrub: request body, cookies, auth headers, query string dropped', !ev.request.data && !ev.request.cookies && !ev.request.headers.authorization && !ev.request.headers.cookie && ev.request.headers['user-agent'] === 'UA' && ev.request.url === 'https://api/x', ev.request);
  check('scrub: user reduced to id, extra removed, console breadcrumbs dropped', ev.user.id === 'u1' && !ev.user.email && !ev.user.ip_address && !ev.extra && ev.breadcrumbs.length === 1 && !ev.breadcrumbs[0].data.body && ev.breadcrumbs[0].data.url === '/api/chat', ev);
  check('scrub: exception text + frame vars scrubbed', !ev.exception.values[0].value.includes('a@b.com') && !ev.exception.values[0].stacktrace.frames[0].vars);

  // ---------------- pure: reach-out rules ----------------
  const ro = require(`${SRV}/services/reachOut`);
  const now = IST('2026-11-22T11:00:00Z'); // Sunday 11:00 IST
  const merged = ro.mergeFollowUps([], [
    { event: 'your exam', date: '2026-11-27' },
    { event: 'your exam', date: '2026-11-27' },           // duplicate
    { event: 'old thing', date: '2026-11-01' },           // past
    { event: 'far trip', date: '2027-06-01' },            // > 60 days
    { event: 'x', date: '2026-11-25' },                   // too short
    { event: 'the interview', date: 'next friday' },      // not a date
    { event: '<b>party</b> at Riya\'s', date: '2026-11-23' },
  ], now);
  check('follow-ups: only real future dates within 60 days, de-duplicated, cleaned', merged.length === 2 && merged.some((f: any) => f.text === 'your exam') && merged.some((f: any) => !/[<>]/.test(f.text) && /party/.test(f.text)), merged);
  const exam = merged.find((f: any) => f.text === 'your exam');
  check('follow-ups: not "around now" before the day', ro.followUpPromptLine(merged, now) === '' || /party/.test(ro.followUpPromptLine(merged, now)) === false);
  const onDay = IST('2026-11-27T15:00:00Z');
  check('follow-ups: prompt line on the day mentions it once, lightly', /your exam \(today\)/.test(ro.followUpPromptLine([exam], onDay)) && /once/.test(ro.followUpPromptLine([exam], onDay)), ro.followUpPromptLine([exam], onDay));
  check('follow-ups: check-in due the day after (not on the day, not after 3 days)', !ro.dueForCheckIn([exam], onDay) && !!ro.dueForCheckIn([exam], IST('2026-11-28T11:00:00Z')) && !ro.dueForCheckIn([exam], IST('2026-12-02T11:00:00Z')));
  const at11 = IST('2026-11-28T11:00:00Z');
  check('reach-out: allowed at 11:00 IST normally', ro.reachOutBlockedReason({}, undefined, at11) === null);
  check('reach-out: quiet hours 21:00–10:00 IST', ro.reachOutBlockedReason({}, undefined, IST('2026-11-28T22:30:00Z')) === 'quiet_hours' && ro.reachOutBlockedReason({}, undefined, IST('2026-11-28T09:30:00Z')) === 'quiet_hours');
  check('reach-out: never within 48 h of a crisis', ro.reachOutBlockedReason({ lastCrisisAt: new Date(at11.getTime() - 30 * 3600_000) }, undefined, at11) === 'crisis_recent');
  check('reach-out: max 1 per day', ro.reachOutBlockedReason({ lastSentAt: new Date(at11.getTime() - 3600_000) }, undefined, at11) === 'already_today');
  check('reach-out: off switch', ro.reachOutBlockedReason({ enabled: false }, undefined, at11) === 'off');
  check('reach-out: not while they are active', ro.reachOutBlockedReason({}, new Date(at11.getTime() - 60_000), at11) === 'active_recently');
  check('reach-out: check-in copy is gentle, no guilt', /how did your exam go\? No pressure/.test(ro.checkInText('Mira', 'your exam')) && !/miss|where (are|were) you|ignor/i.test(ro.checkInText('Mira', 'your exam')));

  const two = ro.mergeFollowUps([], [{ event: 'your exam', date: '2026-11-27' }, { event: 'the dentist', date: '2026-11-27' }, { event: 'the match', date: '2026-11-29' }], now)
    .map((f: any, i: number) => ({ ...f, _id: 'f' + i }));
  const fakeUser = (extra: any = {}) => ({ name: 'Mira Rao', persona: 'aastha', followUps: two.map((f: any) => ({ ...f, text: require(`${SRV}/utils/serverEncryption`).encrypt(f.text) })), reachOut: {}, ...extra });
  const up = ro.upcomingCheckIns(fakeUser(), now);
  check('phone schedule: one check-in per day, 10:00 IST the day after', up.length === 2 && up[0].at === IST('2026-11-28T10:00:00Z').toISOString() && up[1].at === IST('2026-11-30T10:00:00Z').toISOString() && /Hey Mira/.test(up[0].body), up);
  check('phone schedule: empty when switched off', ro.upcomingCheckIns(fakeUser({ reachOut: { enabled: false } }), now).length === 0);
  check('phone schedule: skips the crisis cooldown', ro.upcomingCheckIns(fakeUser({ reachOut: { lastCrisisAt: IST('2026-11-27T20:00:00Z') } }), now).every((c: any) => c.at !== IST('2026-11-28T10:00:00Z').toISOString()));

  // ---------------- per-user time zones ----------------
  const tzu = require(`${SRV}/utils/timeZone`);
  check('tz: valid zones accepted, junk rejected (falls back to India)', tzu.cleanTimeZone('America/New_York') === 'America/New_York' && tzu.cleanTimeZone('Mars/Base') === null && tzu.cleanTimeZone('a b; drop') === null && tzu.tzOrDefault(undefined) === 'Asia/Kolkata');
  check('tz: localAt is DST-safe (New York summer vs winter)', tzu.localAt('2026-07-01', 10, 'America/New_York').toISOString() === '2026-07-01T14:00:00.000Z' && tzu.localAt('2026-12-01', 10, 'America/New_York').toISOString() === '2026-12-01T15:00:00.000Z');
  check('tz: localAt across the DST switch day (London, 29 Mar 2026)', tzu.localAt('2026-03-29', 10, 'Europe/London').toISOString() === '2026-03-29T09:00:00.000Z');
  check('tz: India unchanged (10:00 IST = 04:30 UTC)', tzu.localAt('2026-11-28', 10, 'Asia/Kolkata').toISOString() === '2026-11-28T04:30:00.000Z');
  const ny = 'America/New_York';
  const nyNow = new Date('2026-11-22T16:00:00Z'); // 11:00 in New York
  const nyList = ro.mergeFollowUps([], [{ event: 'your exam', date: '2026-11-27' }], nyNow, ny).map((f: any) => ({ ...f, _id: 'n1' }));
  check('tz: follow-up date is the user\'s local day', tzu.dayKeyIn(nyList[0].dueDate, ny) === '2026-11-27');
  const nyUser = { name: 'Sam Lee', persona: 'aastha', timeZone: ny, reachOut: {}, followUps: nyList.map((f: any) => ({ ...f, text: require(`${SRV}/utils/serverEncryption`).encrypt(f.text) })) };
  const nyUp = ro.upcomingCheckIns(nyUser, nyNow);
  check('tz: phone check-in at 10:00 New York time the day after', nyUp.length === 1 && nyUp[0].at === '2026-11-28T15:00:00.000Z', nyUp);
  // 11:00 IST = 00:30 New York → quiet for the NY user, fine for an Indian user
  check('tz: quiet hours use the user\'s clock', ro.reachOutBlockedReason({}, undefined, at11, ny) === 'quiet_hours' && ro.reachOutBlockedReason({}, undefined, at11, 'Asia/Kolkata') === null);
  check('tz: "1 per day" counts the user\'s local day', ro.reachOutBlockedReason({ lastSentAt: new Date('2026-11-28T03:00:00Z') }, undefined, new Date('2026-11-28T16:00:00Z'), ny) === null
    && ro.reachOutBlockedReason({ lastSentAt: new Date('2026-11-28T15:00:00Z') }, undefined, new Date('2026-11-28T20:00:00Z'), ny) === 'already_today');

  // ---------------- pure: mood insights ----------------
  const { computeInsights } = require(`${SRV}/services/moodInsights`);
  const daily = new Map<string, any>();
  const diaryDays = new Set<string>();
  const dayKey = (n: number) => new Date(Date.parse('2026-11-22T00:00:00Z') - n * 86400_000).toISOString().slice(0, 10);
  for (let i = 0; i < 12; i++) { daily.set(dayKey(i), { score: i % 2 ? 4 : 7, mood: 'x' }); if (i % 2 === 0) diaryDays.add(dayKey(i)); }
  const ins = computeInsights(daily, diaryDays, now);
  check('mood: 7-day view ends today', ins.week.length === 7 && ins.week[6].day === '2026-11-22' && ins.week[6].score === 7, ins.week);
  check('mood: journaling insight when the gap is real', /journaled/.test(ins.insight || '') && /7\/10/.test(ins.insight) && ins.note.includes('not a diagnosis'), ins.insight);
  const flat = new Map<string, any>(); for (let i = 0; i < 12; i++) flat.set(dayKey(i), { score: 6, mood: 'x' });
  check('mood: no insight when there is no real difference', computeInsights(flat, diaryDays, now).insight === null);
  check('mood: no insight from too little data', computeInsights(new Map([[dayKey(0), { score: 9, mood: 'x' }], [dayKey(1), { score: 2, mood: 'x' }]]), new Set([dayKey(0)]), now).insight === null);

  // ---------------- DB-backed ----------------
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const Message = require(`${SRV}/models/Message`).default;
  const VoiceNote = require(`${SRV}/models/VoiceNote`).default;
  const { encrypt, decrypt } = require(`${SRV}/utils/serverEncryption`);
  const chat = require(`${SRV}/controllers/chatController`);
  const audio = require(`${SRV}/controllers/audioController`);
  const me = require(`${SRV}/controllers/meController`);
  const llm = require(`${SRV}/services/llm`);

  let lastPrompt = '';
  llm._health.reset();
  const fake = () => ({
    stream: (_m: string, _k: number, msgs: any[]) => { lastPrompt = msgs[0].content; return (async function* () { yield 'Good luck, you have got this!'; })(); },
    complete: async () => '{"mood":"neutral","strategy":"reply","suggested_replies":[]}',
  });
  llm._setAdaptersForTest({ groq: fake(), gemini: fake() }, { groq: 1, gemini: 1 });

  const mkUser = (extra: any = {}) => User.create({
    name: 'Mira Rao', username: 'm' + Math.random().toString(36).slice(2, 8), dateOfBirth: new Date('2001-01-01'),
    emailEncrypted: encrypt(Math.random() + '@x.com'), passwordHash: 'x', isVerified: true, ...extra,
  });
  const run = async (user: any, body: any) => {
    const writes: string[] = [];
    const res: any = { headersSent: true, setHeader() {}, write(c: string) { writes.push(c); return true; }, end() {}, status() { return res; }, json(b: any) { writes.push('JSON:' + JSON.stringify(b)); } };
    await chat.chatWithAI({ user, body } as any, res);
    const events = writes.filter(w => w.startsWith('data: ') && !w.includes('[DONE]')).map(w => { try { return JSON.parse(w.slice(6)); } catch { return w; } });
    return { events, text: events.filter((e: any) => e && typeof e.content === 'string' && !e.type).map((e: any) => e.content).join('') };
  };

  // 7.1 credits pill: count AFTER this message
  const u = await mkUser();
  const r1 = await run(u, { message: 'hey' });
  const meta = r1.events.find((e: any) => e.meta?.credits !== undefined)?.meta;
  check('credits: first message of the day → 15 left (was off by one: 16)', meta?.credits === 15, meta);
  check('quota: 24 h window opens with the first message (meta.resetsAt ≈ now + 24 h)', !!meta?.resetsAt && Math.abs(Date.parse(meta.resetsAt) - (Date.now() + 86400_000)) < 120_000, meta);
  const saved = r1.events.find((e: any) => e.type === 'saved');
  check('saved event carries the real assistant id', saved && mongoose.isValidObjectId(saved.assistantId), saved);

  // the app's time zone is remembered from chat; junk is ignored
  const tzUser = await mkUser();
  await run(tzUser, { message: 'hi', timeZone: 'America/New_York' });
  const tzAfter = (await User.findById(tzUser._id).lean()).timeZone;
  await run(await User.findById(tzUser._id), { message: 'hi again', timeZone: '<script>' });
  check('tz: device zone saved from chat, invalid values ignored', tzAfter === 'America/New_York' && (await User.findById(tzUser._id).lean()).timeZone === 'America/New_York');

  // reactions
  const call =async (fn: any, user: any, body: any = {}, extra: any = {}) => { const res = mockRes(); await fn({ user, body, ...extra } as any, res); return res; };
  let res = await call(chat.reactToMessage, u, { messageId: saved.assistantId, reaction: '😂' });
  check('react: 😂 saved on Aastha\'s reply', res.statusCode === 200 && (await Message.findById(saved.assistantId)).userReaction === '😂', res.body);
  const rx = require(`${SRV}/services/reactions`);
  check('react: any single emoji allowed (incl. skin tone, ZWJ, flag)', ['🔥', '👍🏽', '👩‍💻', '🇮🇳', '❤️', '🥹'].every((e) => rx.isAllowedReaction(e)));
  check('react: text, markup, several emojis rejected', ['hello', '<b>', '😂😂', 'ok👍', '', '1', 'x'.repeat(20)].every((e) => !rx.isAllowedReaction(e)));
  res = await call(chat.reactToMessage, u, { messageId: saved.assistantId, reaction: 'lol' });
  check('react: non-emoji rejected by the API', res.statusCode === 400);
  res = await call(chat.reactToMessage, u, { messageId: saved.userId, reaction: '❤️' });
  check('react: can\'t react to your own message', res.statusCode === 404);
  const other = await mkUser();
  res = await call(chat.reactToMessage, other, { messageId: saved.assistantId, reaction: '❤️' });
  check('react: can\'t react to someone else\'s message', res.statusCode === 404 && (await Message.findById(saved.assistantId)).userReaction === '😂');
  await run(await User.findById(u._id), { message: 'what are you up to' });
  check('react: "what landed" line reaches the next prompt', /laughed at "Good luck, you have got this!"/.test(lastPrompt), lastPrompt.slice(-600));
  const hist = mockRes(); await chat.getChatHistory({ user: u, query: {} } as any, hist);
  check('history returns your reaction', hist.body.some((m: any) => m.myReaction === '😂'));
  res = await call(chat.reactToMessage, u, { messageId: saved.assistantId, reaction: null });
  check('react: null clears it', res.statusCode === 200 && !(await Message.findById(saved.assistantId)).userReaction);

  // user voice notes
  const bytes = Buffer.from('OggS-fake-opus-audio-bytes-'.repeat(20));
  const vr = await run(await User.findById(u._id), { audio: `data:audio/webm;codecs=opus;base64,${bytes.toString('base64')}` });
  const tr = vr.events.find((e: any) => e.type === 'transcript');
  check('voice note: transcript event with a playable link', tr && /^\/api\/ai\/stream\/uv-/.test(tr.voice_note) && typeof tr.text === 'string', tr);
  const vid = tr.voice_note.split('/').pop();
  const stored = await VoiceNote.findOne({ id: vid }).lean();
  check('voice note: stored encrypted, owner-linked, 30-day TTL model', stored && stored.encrypted === true && String(stored.user) === String(u._id) && !Buffer.from(stored.buffer.buffer || stored.buffer).includes(Buffer.from('OggS-fake')), { enc: stored?.encrypted });
  const ar = mockRes(); await audio.getAudio({ params: { id: vid }, headers: {} } as any, ar);
  check('voice note: plays back the original bytes with its type', ar.headers['content-type'] === 'audio/webm' && Buffer.compare(ar.chunks[0], bytes) === 0, ar.headers);
  const ar2 = mockRes(); await audio.getAudio({ params: { id: vid }, headers: { range: 'bytes=0-9' } } as any, ar2);
  check('voice note: range requests still work (seek)', ar2.statusCode === 206 && ar2.chunks[0].length === 10);
  const userMsg = await Message.findOne({ user: u._id, role: 'user', voice_note: tr.voice_note }).lean();
  check('voice note: your message is saved with its recording + transcript', !!userMsg && decrypt(userMsg.content) === tr.text);
  const bad = await run(await User.findById(u._id), { audio: `data:text/html;base64,${Buffer.from('<script>').toString('base64')}` });
  check('voice note: non-audio upload rejected, nothing stored', bad.events.some((e: any) => e.type === 'error') && (await VoiceNote.countDocuments({ user: u._id, encrypted: true })) === 1, bad.events);
  check('voice note: oversized upload rejected', audio.parseAudioDataUrl(`data:audio/webm;base64,${Buffer.alloc(audio.MAX_USER_AUDIO_BYTES + 10).toString('base64')}`) === null);

  // follow-ups in chat + crisis cooldown
  const today = new Date();
  const todayKey = ro.istDayKey(today);
  await User.updateOne({ _id: u._id }, { $set: { followUps: [{ text: encrypt('your exam'), dueDate: ro.istAt(todayKey, 12), status: 'pending' }] } });
  await run(await User.findById(u._id), { message: 'hii' });
  check('follow-up: mentioned in the prompt on the day', /your exam \(today\)/.test(lastPrompt), lastPrompt.slice(-500));
  check('follow-up: marked "asked" → no extra notification', (await User.findById(u._id).lean()).followUps[0].status === 'asked');
  const crisisUser = await mkUser();
  await run(crisisUser, { message: 'i want to die' });
  check('crisis message starts the 48 h check-in cooldown', !!(await User.findById(crisisUser._id).lean()).reachOut?.lastCrisisAt);
  res = await call(me.updateReachOut, u, { enabled: false });
  const gr = await call(me.getReachOut, u);
  check('reach-out: off switch saved + nothing to schedule', gr.body.enabled === false && gr.body.upcoming.length === 0, gr.body);

  // web-push sweep (stub the sender)
  const wp = require(`${SRV}/services/webPush`);
  const sent: any[] = [];
  wp.isWebPushConfigured = () => true;
  wp.sendToUser = async (id: string, p: any) => { sent.push({ id, p }); return 1; };
  const sweepUser = await mkUser({ lastVisit: new Date(Date.now() - 2 * 86400_000), followUps: [{ text: encrypt('the interview'), dueDate: new Date(at11.getTime() - 86400_000), status: 'pending' }] });
  const n1 = await ro.runReachOutSweep(at11);
  const n2 = await ro.runReachOutSweep(new Date(at11.getTime() + 3600_000));
  const after = await User.findById(sweepUser._id).lean();
  check('sweep: one gentle push the day after, then marked sent (no repeats)', n1 === 1 && n2 === 0 && sent.length === 1 && /how did the interview go/.test(sent[0].p.body) && after.followUps[0].status === 'sent', { n1, n2, sent });
  check('sweep: nothing during quiet hours', (await ro.runReachOutSweep(IST('2026-11-28T23:00:00Z'))) === 0);

  // export
  const ex = await call(me.exportMyData, u);
  check('export: decrypted chats, memory, moods, settings — no ciphertext', ex.statusCode === 200 && ex.body.format === 'aastha-export-v1' && ex.body.chats.length >= 6 && ex.body.chats.every((c: any) => !/^[0-9a-f]{24,}:/.test(c.content)) && Array.isArray(ex.body.memory.facts) && ex.body.profile.settings.checkIns === false, Object.keys(ex.body || {}));
  check('export: no password hash / tokens / push keys', !JSON.stringify(ex.body).match(/passwordHash|tokenVersion|p256dh|otpCode/));
  await call(me.exportMyData, u); await call(me.exportMyData, u);
  check('export: limited to 3 per hour', (await call(me.exportMyData, u)).statusCode === 429);

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
