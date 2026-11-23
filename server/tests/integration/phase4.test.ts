/* Phase 4: Web Push (no Firebase) — subscription validation/storage, expired-subscription cleanup,
   push-before-email ghost path. In-memory MongoDB; web-push's network call is stubbed. */
process.env.SERVER_ENCRYPTION_KEY = 'k';
process.env.JWT_SECRET = 'x';
const SRV = require('path').resolve(__dirname, '../../src');

// Real-format test VAPID keys generated locally for this test only
const webpushLib = require('web-push');
const keys = webpushLib.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 300));
  if (!cond) failures++;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const push = require(`${SRV}/services/webPush`);
  const { encrypt } = require(`${SRV}/utils/serverEncryption`);

  // ---- validation ----
  const good = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
  check('valid subscription accepted', push.isValidSubscription(good));
  check('http endpoint rejected', !push.isValidSubscription({ ...good, endpoint: 'http://evil.example/x' }));
  check('missing keys rejected', !push.isValidSubscription({ endpoint: good.endpoint }));
  check('configured with VAPID env', push.isWebPushConfigured() && push.getPublicKey() === keys.publicKey);

  // ---- storage: dedupe + cap ----
  const u = await User.create({ name: 'T', username: 't1', dateOfBirth: new Date('2000-01-01'), emailEncrypted: encrypt('t@x.com'), passwordHash: 'x' });
  await push.addSubscription(u._id.toString(), good, 'UA');
  await push.addSubscription(u._id.toString(), good, 'UA'); // same endpoint again
  let stored = (await User.findById(u._id).select('pushSubscriptions').lean()).pushSubscriptions;
  check('same endpoint stored once', stored.length === 1, stored.length);
  for (let i = 0; i < 8; i++) await push.addSubscription(u._id.toString(), { ...good, endpoint: `https://push.example/${i}` });
  stored = (await User.findById(u._id).select('pushSubscriptions').lean()).pushSubscriptions;
  check('capped at 5 most recent devices', stored.length === push.MAX_SUBSCRIPTIONS_PER_USER && stored[4].endpoint === 'https://push.example/7', stored.map((s: any) => s.endpoint));
  check('subscriptions hidden from normal user queries (select:false)', (await User.findById(u._id).lean()).pushSubscriptions === undefined);

  // ---- send: success + expired cleanup ----
  const sent: string[] = [];
  webpushLib.sendNotification = async (sub: any, payload: string) => {
    sent.push(sub.endpoint);
    if (sub.endpoint.endsWith('/5')) { const e: any = new Error('gone'); e.statusCode = 410; throw e; }
    if (sub.endpoint.endsWith('/6')) { const e: any = new Error('boom'); e.statusCode = 500; throw e; }
    JSON.parse(payload);
    return { statusCode: 201 };
  };
  const delivered = await push.sendToUser(u._id.toString(), { title: 'Aastha', body: 'hi' });
  stored = (await User.findById(u._id).select('pushSubscriptions').lean()).pushSubscriptions;
  check('sends to every device', sent.length === 5, sent);
  check('counts accepted deliveries', delivered === 3, delivered);
  check('410 Gone subscription removed, 500 kept for retry', !stored.some((s: any) => s.endpoint.endsWith('/5')) && stored.some((s: any) => s.endpoint.endsWith('/6')), stored.map((s: any) => s.endpoint));

  // ---- unsubscribe ----
  await push.removeSubscription(u._id.toString(), 'https://push.example/6');
  stored = (await User.findById(u._id).select('pushSubscriptions').lean()).pushSubscriptions;
  check('unsubscribe removes endpoint', !stored.some((s: any) => s.endpoint.endsWith('/6')));

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
