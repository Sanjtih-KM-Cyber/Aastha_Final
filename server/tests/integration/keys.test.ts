/* Key rotation + encryption coverage (2026-11-23). In-memory MongoDB.
   Simulates an OLD deployment (one SERVER_ENCRYPTION_KEY, legacy ciphertext format, plaintext leftovers),
   rotates to new keys, runs the sweep, then removes the old key and checks nothing broke. */
process.env.SERVER_ENCRYPTION_KEY = 'old-secret';
delete process.env.NEW_SERVER_ENCRYPTION_KEY;
delete process.env.ENCRYPTION_KEYS;
delete process.env.BLIND_INDEX_KEYS;
delete process.env.BLIND_INDEX_KEY;
process.env.JWT_SECRET = 'jwt-old';
delete process.env.RESEND_API_KEY;
const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 400));
  if (!cond) failures++;
};
const mockRes = () => {
  const r: any = { statusCode: 200, body: null, cookies: {} };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.cookie = (k: string, v: any) => { r.cookies[k] = v; return r; };
  r.clearCookie = () => r;
  return r;
};
/** The pre-2026-11-23 format: iv:tag:data, key = sha256(secret), no key id. */
const legacyEncrypt = (text: string, secret: string) => {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  let e = c.update(text, 'utf8', 'hex'); e += c.final('hex');
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${e}`;
};
const oldBlind = (v: string) => crypto.createHmac('sha256', 'old-secret').update(v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const enc = require(`${SRV}/utils/serverEncryption`);
  const User = require(`${SRV}/models/User`).default;
  const Message = require(`${SRV}/models/Message`).default;
  const TrainingLog = require(`${SRV}/models/TrainingLog`).default;
  const VoiceNote = require(`${SRV}/models/VoiceNote`).default;
  const { Person } = require(`${SRV}/models/Person`);
  const det = require(`${SRV}/services/detectiveService`);
  const rot = require(`${SRV}/services/keyRotation`);
  const audio = require(`${SRV}/controllers/audioController`);
  const auth = require(`${SRV}/controllers/authController`);
  const { verifyJwt } = require(`${SRV}/utils/jwtKeys`);
  await Promise.all([User.init(), Person.init()]);
  const db = mongoose.connection.db;

  // ── format ──
  const oldKid = enc.currentKeyId();
  const c1 = enc.encrypt('hello');
  check('new ciphertext carries a key id (v2:<kid>:…)', c1.startsWith(`v2:${oldKid}:`) && enc.decrypt(c1) === 'hello', c1);
  check('legacy iv:tag:data still decrypts', enc.decrypt(legacyEncrypt('legacy hi', 'old-secret')) === 'legacy hi');
  check('plaintext passes through decrypt unchanged', enc.decrypt('just text') === 'just text');

  // ── an "old deployment": plaintext leftovers + legacy ciphertext ──
  const pw = await bcrypt.hash('pw123456', 4);
  const { insertedId: uid } = await db.collection('users').insertOne({
    name: 'Mira Sen', email: 'mira@x.com', emailHash: sha('mira@x.com'), emailEncrypted: legacyEncrypt('mira@x.com', 'old-secret'),
    username: 'mira', passwordHash: pw, isVerified: true, dateOfBirth: new Date('2000-05-17T00:00:00Z'),
    avatar: 'data:image/png;base64,AAAA', wallpaper: 'data:image/png;base64,BBBB', region: 'Kolkata',
    facts: [legacyEncrypt('likes chai', 'old-secret')], lore: [{ topic: 'College', mentionCount: 3, isUnlocked: true }],
    openLoops: [{ event: 'exam on friday', date: new Date(), status: 'pending' }], tokenVersion: 0, createdAt: new Date(),
  });
  await db.collection('messages').insertOne({ user: uid, role: 'user', content: legacyEncrypt('I miss home', 'old-secret'), timestamp: new Date() });
  await db.collection('people').insertOne({ userId: uid, name: enc.encrypt('Riya'), nameHash: oldBlind('Riya'), alias: enc.encrypt('R'), rapSheet: [legacyEncrypt('plans trips', 'old-secret')], role: 'best_friend', vibe: 'supportive', relationshipScore: 70 });
  await db.collection('traininglogs').insertOne({ userMood: 'ok', persona: 'aastha', input: 'plain input', output: 'plain output', createdAt: new Date() });
  await db.collection('voicenotes').insertOne({ id: 'tts-1', user: uid, buffer: Buffer.from('RIFFwav-bytes'), encrypted: false, createdAt: new Date() });

  // ── rotate: new keys first, old key kept ──
  process.env.ENCRYPTION_KEYS = 'new-secret';
  process.env.BLIND_INDEX_KEYS = 'blind-new';
  const newKid = enc.currentKeyId();
  check('new key is current; old key still in the ring', newKid !== oldKid && enc.encryptionKeys().some((k: any) => k.kid === oldKid));
  check('new writes use the new key', enc.encrypt('x').startsWith(`v2:${newKid}:`));
  check('old data still readable mid-rotation', enc.decrypt(c1) === 'hello');
  await det.upsertPerson(String(uid), { name: 'RIYA', score: 72, role: 'best_friend', vibe: 'supportive', rapSheet: ['plans trips'] });
  check('Web: re-mentioning a person before the sweep finds the old row (old blind key still tried)', (await Person.countDocuments({ userId: uid })) === 1);

  // login before the sweep: legacy unkeyed email hash still matches
  let res = mockRes();
  await auth.loginUser({ body: { identifier: 'MIRA@x.com', password: 'pw123456' }, headers: {}, query: {}, ip: '1.1.1.1' } as any, res);
  check('login works mid-rotation (legacy email hash)', res.statusCode === 200 && res.body?.email === 'mira@x.com', { s: res.statusCode, b: res.body });
  let raw: any = await db.collection('users').findOne({ _id: uid });
  check('login removed the plaintext email and re-keyed the email hash', !raw.email && raw.emailHash === enc.blindIndex('mira@x.com'), raw.emailHash);

  // ── the sweep ──
  const stats = await rot.runKeyRotation({ log: () => {} });
  check('sweep re-encrypted old ciphertext + encrypted plaintext leftovers', stats.reencrypted >= 2 && stats.encryptedPlain >= 8 && stats.unreadable === 0, stats);
  raw = await db.collection('users').findOne({ _id: uid });
  const onNew = (v: any) => typeof v === 'string' && v.startsWith(`v2:${newKid}:`);
  check('user PII encrypted at rest on the new key (name, region, avatar, wallpaper, DOB, email)',
    onNew(raw.name) && onNew(raw.region) && onNew(raw.avatar) && onNew(raw.wallpaper) && onNew(raw.dateOfBirth) && onNew(raw.emailEncrypted) && !raw.email, raw);
  check('legacy memory fields encrypted (facts, lore topic, open loop)', onNew(raw.facts[0]) && onNew(raw.lore[0].topic) && onNew(raw.openLoops[0].event));
  const msg: any = await db.collection('messages').findOne({ user: uid });
  check('chat message re-encrypted', onNew(msg.content) && enc.decrypt(msg.content) === 'I miss home');
  const person: any = await db.collection('people').findOne({ userId: uid });
  check('Web person re-encrypted + blind index recomputed with the new blind key', onNew(person.name) && onNew(person.rapSheet[0]) && person.nameHash === enc.blindIndex('Riya'));
  const tl: any = await db.collection('traininglogs').findOne({});
  check('training pairs encrypted', onNew(tl.input) && onNew(tl.output));
  const vn: any = await VoiceNote.findOne({ id: 'tts-1' });
  check('Aastha voice replies encrypted (and still play)', vn.encrypted === true && !String(vn.buffer).includes('RIFF') && audio.readAudio(vn).toString() === 'RIFFwav-bytes');

  // app still reads everything normally
  const u: any = await User.findById(uid);
  check('model getters decrypt (name, region, avatar, DOB as a Date)', u.name === 'Mira Sen' && u.region === 'Kolkata' && u.avatar === 'data:image/png;base64,AAAA' && u.dateOfBirth instanceof Date && u.dateOfBirth.toISOString().startsWith('2000-05-17'), { n: u.name, d: u.dateOfBirth });
  check('toJSON decrypts too (no ciphertext leaks into API responses)', JSON.stringify(u.toJSON()).includes('Mira Sen') && !JSON.stringify(u.toJSON()).includes(raw.name));
  const t: any = await TrainingLog.findOne({});
  check('training log getter decrypts', t.input === 'plain input');

  const again = await rot.runKeyRotation({ log: () => {} });
  check('second run is a no-op (state recorded)', again.scanned === 0, again);
  const st = await rot.keyStatus();
  check('keys:status reports nothing pending', Object.values(st.perCollection).every((s: any) => s.pending === 0 && s.unreadable === 0), st.perCollection);

  // ── drop the old key: nothing breaks ──
  delete process.env.SERVER_ENCRYPTION_KEY;
  check('old key removed from the ring', !enc.encryptionKeys().some((k: any) => k.kid === oldKid) && enc.blindKeys().length === 1);
  const u2: any = await User.findById(uid);
  check('everything still decrypts with only the new key', u2.name === 'Mira Sen' && enc.decrypt(msg.content) === 'I miss home');
  const web = await det.detectiveService.getWeb(String(uid));
  check('The Web still works (names + facts)', web.length === 1 && web[0].name.toLowerCase() === 'riya' && web[0].rapSheet[0] === 'plans trips', web);
  await det.upsertPerson(String(uid), { name: 'riya', score: 80, role: 'best_friend', vibe: 'warm' });
  check('re-mentioning a person updates the same row (blind index matches)', (await Person.countDocuments({ userId: uid })) === 1);
  res = mockRes();
  await auth.loginUser({ body: { identifier: 'mira@x.com', password: 'pw123456' }, headers: {}, query: {}, ip: '1.1.1.2' } as any, res);
  check('login by email works after the old key is gone', res.statusCode === 200, { s: res.statusCode, b: res.body });

  // ── a missing key is loud, never destructive ──
  const foreign = legacyEncrypt('secret from a lost key', 'some-other-key');
  await db.collection('messages').insertOne({ user: uid, role: 'user', content: foreign, timestamp: new Date() });
  const before = enc.decryptFailureCount();
  check('ciphertext from an unknown key is returned as-is (not garbled)', enc.decrypt(foreign) === foreign && enc.decryptFailureCount() === before + 1);
  const s3 = await rot.runKeyRotation({ force: true, log: () => {} });
  check('sweep reports unreadable values and leaves them untouched', s3.unreadable === 1 && (await db.collection('messages').findOne({ content: foreign })) !== null, s3);

  // ── new accounts: no plaintext ──
  const nu = await User.create({ name: 'Arjun', emailEncrypted: enc.encrypt('a@x.com'), emailHash: enc.blindIndex('a@x.com'), passwordHash: 'x', region: 'Pune', dateOfBirth: new Date('1999-01-02') });
  const rawNu: any = await db.collection('users').findOne({ _id: nu._id });
  check('new user: name/region/DOB stored encrypted', onNew(rawNu.name) && onNew(rawNu.region) && onNew(rawNu.dateOfBirth) && !rawNu.email);
  await User.updateOne({ _id: nu._id }, { $set: { avatar: 'data:image/png;base64,CCCC' } });
  check('update queries encrypt too (setters run on $set)', onNew((await db.collection('users').findOne({ _id: nu._id })).avatar));

  // ── JWT secret rotation ──
  const oldToken = jwt.sign({ id: 'abc' }, 'jwt-old', { expiresIn: '1h' });
  process.env.JWT_SECRET = 'jwt-new';
  let threw = false; try { verifyJwt(oldToken); } catch { threw = true; }
  check('without JWT_SECRET_OLD an old token is rejected', threw);
  process.env.JWT_SECRET_OLD = 'jwt-old';
  check('with JWT_SECRET_OLD old sessions keep working', verifyJwt(oldToken).id === 'abc');
  check('new tokens verify with the new secret', verifyJwt(jwt.sign({ id: 'n' }, 'jwt-new')).id === 'n');
  const expired = jwt.sign({ id: 'e', exp: Math.floor(Date.now() / 1000) - 10 }, 'jwt-old');
  threw = false; try { verifyJwt(expired); } catch (e: any) { threw = e.name === 'TokenExpiredError'; }
  check('expired tokens stay expired', threw);

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
