/* Integration checks for Phase 1 (messageStore migration/pagination, IST daily reset, re-encryption check). */
process.env.SERVER_ENCRYPTION_KEY = 'old-key-for-test';
process.env.JWT_SECRET = 'x';

const SRV = require('path').resolve(__dirname, '../../src');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : extra);
  if (!cond) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Chat = require(`${SRV}/models/Chat`).default;
  const Message = require(`${SRV}/models/Message`).default;
  const store = require(`${SRV}/services/messageStore`);
  const { encrypt, decrypt } = require(`${SRV}/utils/serverEncryption`);
  await Message.syncIndexes();
  await Chat.syncIndexes();

  // ---------- 1. Lazy migration of a legacy chat ----------
  const uid = new mongoose.Types.ObjectId();
  const base = Date.UTC(2026, 0, 1);
  const legacy = Array.from({ length: 120 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: encrypt(`msg ${i}`),
    timestamp: new Date(base + i * 1000),
  }));
  await Chat.create({ user: uid, messages: legacy });

  // Concurrent first requests must not double-copy
  const [a, b] = await Promise.all([store.getRecentMessages(uid, 20), store.getRecentMessages(uid, 20)]);
  check('migration copies all 120 legacy messages exactly once', (await Message.countDocuments({ user: uid })) === 120,
    await Message.countDocuments({ user: uid }));
  check('recent page returns 20, oldest→newest', a.length === 20 && decrypt(a[0].content) === 'msg 100' && decrypt(a[19].content) === 'msg 119',
    [decrypt(a[0].content), decrypt(a[19].content)]);
  check('both concurrent callers got the same page', b.length === 20);
  const legacyAfter = await Chat.findOne({ user: uid }).lean();
  check('legacy doc kept as backup + marked migratedAt', legacyAfter.messages.length === 120 && !!legacyAfter.migratedAt);
  check('legacy subdoc ids preserved', String(a[19]._id) === String(legacyAfter.messages[119]._id));

  // ---------- 2. Pagination with `before` ----------
  const older = await store.getRecentMessages(uid, 50, new Date(a[0].timestamp));
  check('`before` page returns the 50 messages before the first one', older.length === 50 &&
    decrypt(older[0].content) === 'msg 50' && decrypt(older[49].content) === 'msg 99',
    [decrypt(older[0].content), decrypt(older[49].content)]);
  const oldest = await store.getRecentMessages(uid, 100, new Date(older[0].timestamp));
  check('last page has the remaining 50 (hasMore would be false)', oldest.length === 50);

  // ---------- 3. Append keeps order, count works ----------
  await store.appendMessages(uid, [
    { role: 'user', content: encrypt('new user') },
    { role: 'assistant', content: encrypt('new reply') },
  ]);
  const latest = await store.getRecentMessages(uid, 2);
  check('appended user msg precedes assistant reply', decrypt(latest[0].content) === 'new user' && decrypt(latest[1].content) === 'new reply');
  check('countMessages = 122', (await store.countMessages(uid)) === 122);

  // ---------- 4. Brand-new user (no legacy chat) ----------
  const fresh = new mongoose.Types.ObjectId();
  check('new user has empty history', (await store.getRecentMessages(fresh, 50)).length === 0);
  check('no legacy Chat doc created for new users', (await Chat.countDocuments({ user: fresh })) === 0);

  // ---------- 5. Streaming iterator (data donation) ----------
  const cursor = await store.iterateAllMessages(uid);
  let n = 0; let prevTs = 0; let ordered = true;
  for await (const m of cursor) { const t = new Date(m.timestamp).getTime(); if (t < prevTs) ordered = false; prevTs = t; n++; }
  check('iterateAllMessages streams all 122 in time order', n === 122 && ordered, n);

  // ---------- 6. Delete account wipes both stores ----------
  await store.deleteAllMessages(uid);
  check('deleteAllMessages wipes Message + legacy Chat',
    (await Message.countDocuments({ user: uid })) === 0 && (await Chat.countDocuments({ user: uid })) === 0);

  // ---------- 7. Rolling 24 h quota window (replaced IST midnight, 2026-11-22) ----------
  const { applyDailyReset, openQuotaWindow, quotaResetsAt, istDayKey } = require(`${SRV}/utils/dailyReset`);
  check('IST day key still available for the bond engine', istDayKey(new Date(Date.UTC(2026, 10, 19, 18, 0))) !== istDayKey(new Date(Date.UTC(2026, 10, 19, 18, 31))));
  const t0 = new Date(Date.UTC(2026, 10, 19, 17, 0)); // 22:30 IST — the old rule would refill 1.5 h later
  const u: any = { dailyMessageCount: 0, dailyVoiceCount: 0, cloneMode: { usageCount: 0 } };
  check('fresh user: nothing to refill, no window', applyDailyReset(u, t0) === false && !u.quotaWindowStart);
  openQuotaWindow(u, t0); u.dailyMessageCount = 16; u.dailyVoiceCount = 2; u.cloneMode.usageCount = 3;
  openQuotaWindow(u, new Date(t0.getTime() + 3600_000));
  check('window starts at the FIRST message (later messages don\'t move it)', +u.quotaWindowStart === +t0 && quotaResetsAt(u) === new Date(+t0 + 86400_000).toISOString());
  check('no refill at midnight IST any more', applyDailyReset(u, new Date(Date.UTC(2026, 10, 19, 18, 31))) === false && u.dailyMessageCount === 16);
  check('no refill 1 min before 24 h', applyDailyReset(u, new Date(+t0 + 86400_000 - 60_000)) === false && u.dailyMessageCount === 16);
  const t24 = new Date(+t0 + 86400_000);
  check('refill exactly 24 h after the first message', applyDailyReset(u, t24) === true && u.dailyMessageCount === 0 &&
    u.dailyVoiceCount === 0 && u.cloneMode.usageCount === 0 && u.quotaWindowStart === null && quotaResetsAt(u) === null);
  check('second call is a no-op (no window open)', applyDailyReset(u, new Date(+t24 + 60000)) === false);
  const legacyQ: any = { dailyResetAt: new Date(+t0 - 3600_000), dailyMessageCount: 9 };
  check('legacy user with usage: window adopted from last reset, no early refill', applyDailyReset(legacyQ, t0) === true && +legacyQ.quotaWindowStart === +legacyQ.dailyResetAt && legacyQ.dailyMessageCount === 9);
  const stale: any = { dailyResetAt: new Date(+t0 - 2 * 86400_000), dailyMessageCount: 16 };
  check('legacy user with an old window: refilled', applyDailyReset(stale, t0) === true && stale.dailyMessageCount === 0);

  // ---------- 8. Key-rotation check no longer always true ----------
  const enc = require(`${SRV}/utils/serverEncryption`);
  const oldCipher = enc.encrypt('hello@example.com'); // written with old key (only key)
  check('no rotation in progress → never re-encrypt', enc.needsReencryption(oldCipher) === false);
  process.env.NEW_SERVER_ENCRYPTION_KEY = 'new-key-for-test';
  check('rotation: old-key ciphertext flagged', enc.needsReencryption(oldCipher) === true);
  const newCipher = enc.encrypt('hello@example.com');
  check('rotation: new-key ciphertext NOT flagged', enc.needsReencryption(newCipher) === false);
  check('rotation: old ciphertext still decrypts via fallback', enc.decrypt(oldCipher) === 'hello@example.com');

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
