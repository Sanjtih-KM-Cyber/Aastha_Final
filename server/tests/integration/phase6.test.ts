/* Phase 6: third-party data encryption (The Web), blind index, legacy migration, diary keyword
   encryption, voice-note deletion with the account, YouTube cache + quota breaker. In-memory MongoDB. */
process.env.SERVER_ENCRYPTION_KEY = 'phase6-key';
process.env.JWT_SECRET = 'x';
process.env.YOUTUBE_API_KEY = 'test-yt-key';
const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const axios = require('axios');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 300));
  if (!cond) failures++;
};
const mockRes = () => {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.cookie = () => r;
  return r;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const enc = require(`${SRV}/utils/serverEncryption`);
  const { Person } = require(`${SRV}/models/Person`);
  const { detectiveService, upsertPerson } = require(`${SRV}/services/detectiveService`);
  await Person.syncIndexes();
  const uid = new mongoose.Types.ObjectId().toString();

  // ---- blind index ----
  check('blind index ignores case/spacing/unicode form', enc.blindIndex('  Riya  Sharma ') === enc.blindIndex('riya sharma'));
  check('blind index differs per name and hides the value', enc.blindIndex('Riya') !== enc.blindIndex('Rhea') && !enc.blindIndex('Riya').includes('riya'));

  // ---- The Web: encrypted at rest ----
  await upsertPerson(uid, { name: 'Riya', alias: 'The Planner', score: 70, verdict: 'KEEPER', rapSheet: ['Always plans trips', 'Texts first'] });
  await upsertPerson(uid, { name: 'riya', alias: 'Planner 2', score: 80, verdict: 'KEEPER', rapSheet: ['Loves chai'] }); // same person, different case
  const raw = await Person.find({ userId: uid }).lean();
  const rawJson = JSON.stringify(raw);
  check('same person (case-insensitive) stored once', raw.length === 1, raw.length);
  check('no plaintext name/alias/notes in the database', !/riya|planner|chai|trips/i.test(rawJson), rawJson.slice(0, 200));
  check('verdict/score stay queryable', raw[0].verdict === 'KEEPER' && raw[0].relationshipScore === 80);

  const web = await detectiveService.getWeb(uid);
  check('getWeb returns decrypted data to the owner', web[0].name === 'riya' && web[0].alias === 'Planner 2' && web[0].rapSheet[0] === 'Loves chai', web[0]);

  // ---- mugshot encrypted ----
  const img = 'data:image/png;base64,' + 'A'.repeat(500);
  const withPhoto = await detectiveService.setMugshot(uid, String(raw[0]._id), img);
  const rawPhoto = (await Person.findById(raw[0]._id).lean()).mugshot;
  check('mugshot encrypted at rest, decrypted for owner', enc.isEncrypted(rawPhoto) && withPhoto.mugshot === img);
  const other = new mongoose.Types.ObjectId().toString();
  check("another user can't set someone else's mugshot", (await detectiveService.setMugshot(other, String(raw[0]._id), img)) === null);

  // ---- legacy plaintext rows migrate on read (incl. duplicate cleanup) ----
  const legacyUser = new mongoose.Types.ObjectId();
  await Person.collection.insertMany([
    { userId: legacyUser, name: 'Arjun', alias: 'The Ghost', relationshipScore: -20, verdict: 'SUSPECT', rapSheet: ['Cancels plans'], mugshot: '', lastUpdated: new Date() },
    { userId: legacyUser, name: 'arjun', alias: 'dup', relationshipScore: 0, verdict: 'NPC', rapSheet: [], mugshot: '', lastUpdated: new Date() },
  ]);
  const legacyWeb = await detectiveService.getWeb(legacyUser.toString());
  const legacyRaw = await Person.find({ userId: legacyUser }).lean();
  check('legacy rows readable after migration', legacyWeb.length === 1 && legacyWeb[0].rapSheet[0] === 'Cancels plans', legacyWeb);
  check('legacy rows now encrypted + indexed, duplicate removed', legacyRaw.length === 1 && enc.isEncrypted(legacyRaw[0].name) && !!legacyRaw[0].nameHash && !/arjun|ghost|cancels/i.test(JSON.stringify(legacyRaw)));

  // ---- regex-injection-proof lookups ----
  const r1 = await detectiveService.updateDossier(uid, { name: '.*', newTrait: 'x' });
  check("a name like '.*' is just a name (no regex matching other people)", r1.status === 'created' && (await Person.countDocuments({ userId: uid })) === 2);

  // ---- diary mood keywords encrypted ----
  const Diary = require(`${SRV}/models/Diary`).default;
  const { createDiaryEntry } = require(`${SRV}/controllers/dataController`);
  const diaryUser = { _id: new mongoose.Types.ObjectId() };
  const res = mockRes();
  await createDiaryEntry({ user: diaryUser, body: { title: 't', content: 'c', date: new Date().toISOString(), moodKeywords: 'exam stress, lonely' } }, res);
  const d = await Diary.findOne({ user: diaryUser._id }).lean();
  check('diary mood keywords encrypted at rest', enc.isEncrypted(d.moodKeywords) && enc.decrypt(d.moodKeywords) === 'exam stress, lonely', d.moodKeywords);

  // ---- voice notes deleted with the account ----
  const User = require(`${SRV}/models/User`).default;
  const VoiceNote = require(`${SRV}/models/VoiceNote`).default;
  const { storeAudio } = require(`${SRV}/controllers/audioController`);
  const { softDeleteUser } = require(`${SRV}/controllers/authController`);
  const u = await User.create({ name: 'V', username: 'v1', dateOfBirth: new Date('2000-01-01'), emailEncrypted: enc.encrypt('v@x.com'), passwordHash: 'x' });
  await storeAudio('vn-test-1', Buffer.from('RIFF'), u._id);
  check('voice note linked to its owner', (await VoiceNote.findOne({ id: 'vn-test-1' }).lean()).user.toString() === u._id.toString());
  await softDeleteUser({ user: { _id: u._id }, body: {} }, mockRes());
  check('account deletion removes voice notes', (await VoiceNote.countDocuments({ user: u._id })) === 0);

  // ---- YouTube cache + quota breaker ----
  const yt = require(`${SRV}/services/youtubeSearch`);
  await yt.YoutubeCache.syncIndexes();
  let calls = 0;
  axios.get = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { data: { items: [{ id: { videoId: 'abc' }, snippet: { title: 'Song', channelTitle: 'Artist', thumbnails: { default: { url: 'u' } } } }] } }; };
  const [a1, a2] = await Promise.all([yt.searchYouTube('Kesariya Arijit', { max: 1 }), yt.searchYouTube('kesariya   arijit', { max: 1 })]);
  check('concurrent identical searches share one API call', calls === 1 && a1[0].id === 'abc' && a2[0].id === 'abc', calls);
  yt._ytInternals.reset(); // drop memory cache → must come from MongoDB
  await yt.searchYouTube('Kesariya Arijit', { max: 1 });
  check('repeat search served from MongoDB cache (no quota used)', calls === 1, calls);

  axios.get = async () => { calls++; const e: any = new Error('quota'); e.response = { status: 403, data: { error: { errors: [{ reason: 'quotaExceeded' }] } } }; throw e; };
  const q1 = await yt.searchYouTube('new song 1');
  const before = calls;
  const q2 = await yt.searchYouTube('new song 2');
  check('quota exhaustion → empty result, then no more API calls until reset', q1.length === 0 && q2.length === 0 && calls === before && yt._ytInternals.blockedUntil > Date.now(), { calls, before });
  check('cached songs still work while quota is exhausted', (await yt.searchYouTube('Kesariya Arijit', { max: 1 }))[0]?.id === 'abc');
  const pm = new Date(yt.nextPacificMidnight(new Date('2026-11-20T07:30:00Z'))); // 23:30 PST on 19 Nov
  check('quota reset time = next midnight Pacific', pm.toISOString() === '2026-11-20T08:00:00.000Z', pm.toISOString());

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
