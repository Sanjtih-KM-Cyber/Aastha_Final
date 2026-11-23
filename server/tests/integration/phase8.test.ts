/* Owner batch 2026-11-23: The Web roles + vibes (AI-chosen, user-correctable), custom mood types,
   synced window-button preference. In-memory MongoDB. */
process.env.SERVER_ENCRYPTION_KEY = 'phase8-key';
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
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const { Person } = require(`${SRV}/models/Person`);
  const { encrypt, decrypt } = require(`${SRV}/utils/serverEncryption`);
  const det = require(`${SRV}/services/detectiveService`);
  const data = require(`${SRV}/controllers/dataController`);
  const me = require(`${SRV}/controllers/meController`);

  const u = await User.create({ name: 'Mira', username: 'm8', dateOfBirth: new Date('2001-01-01'), emailEncrypted: encrypt('m8@x.com'), passwordHash: 'x', isVerified: true });
  const uid = String(u._id);
  const call = async (fn: any, body: any = {}, params: any = {}) => { const res = mockRes(); await fn({ user: u, body, params, query: {} } as any, res); return res; };

  // ---------------- The Web: roles + vibes ----------------
  check('roles include family, partner, ex, crush, mentor, rival… (not just 4 verdicts)', ['parent', 'sibling', 'partner', 'ex', 'crush', 'best_friend', 'colleague', 'mentor', 'rival', 'therapist'].every((r) => det.ROLES.includes(r)) && det.VIBES.length >= 8);
  await det.upsertPerson(uid, { name: 'Riya', alias: 'The Planner', score: 75, role: 'best_friend', vibe: 'supportive', rapSheet: ['Plans trips'] });
  await det.upsertPerson(uid, { name: 'Kabir', score: -30, role: 'Boyfriend', vibe: 'complicated' });           // alias → partner
  await det.upsertPerson(uid, { name: 'Mrs Rao', score: 20, role: 'dance teacher', roleLabel: 'Dance teacher', vibe: 'warm' }); // unknown → other + label
  await det.upsertPerson(uid, { name: 'Old', score: 80, verdict: 'KEEPER' });                                // legacy caller (no vibe)
  await det.upsertPerson(uid, { name: 'Weird', score: 0, role: '<script>', vibe: 'evil' });
  const web = await det.detectiveService.getWeb(uid);
  const by = (n: string) => web.find((p: any) => p.name === n);
  check('AI role + vibe saved as given', by('Riya').role === 'best_friend' && by('Riya').vibe === 'supportive' && by('Riya').verdict === 'KEEPER', by('Riya'));
  check('common words map to roles (boyfriend → partner)', by('Kabir').role === 'partner' && by('Kabir').vibe === 'complicated' && by('Kabir').verdict === 'SUSPECT', by('Kabir'));
  check('unlisted role → "other" with its own (encrypted) label', by('Mrs Rao').role === 'other' && by('Mrs Rao').roleLabel === 'Dance teacher');
  const rawRao = await Person.findOne({ userId: uid, role: 'other' }).lean();
  check('custom role label encrypted at rest', rawRao && rawRao.roleLabel && !rawRao.roleLabel.includes('Dance'));
  check('legacy verdict-only rows still work (vibe derived, verdict kept)', by('Old').verdict === 'KEEPER' && by('Old').vibe === 'supportive', by('Old'));
  check('junk role/vibe from the AI is cleaned', by('Weird').role === 'other' && by('Weird').vibe === 'neutral', by('Weird'));

  // user correction wins over the next scan
  let res = await call(data.updatePersonClassification, { role: 'sibling', vibe: 'warm' }, { id: String(by('Kabir')._id) });
  check('user can correct role + vibe', res.statusCode === 200 && res.body.role === 'sibling' && res.body.vibe === 'warm' && res.body.userEdited === true, res.body);
  await det.upsertPerson(uid, { name: 'Kabir', score: -50, role: 'ex', vibe: 'draining', rapSheet: ['new fact'] });
  const kabir = (await det.detectiveService.getWeb(uid)).find((p: any) => p.name === 'Kabir');
  check('a re-scan updates facts but keeps the user\'s correction', kabir.role === 'sibling' && kabir.vibe === 'warm' && kabir.rapSheet.includes('new fact'), kabir);
  res = await call(data.updatePersonClassification, { vibe: 'nonsense' }, { id: String(by('Kabir')._id) });
  check('invalid vibe rejected', res.statusCode === 404 || res.statusCode === 400);
  const other = await User.create({ name: 'O', username: 'o8', dateOfBirth: new Date('2000-01-01'), emailEncrypted: encrypt('o8@x.com'), passwordHash: 'x', isVerified: true });
  const res2 = mockRes(); await data.updatePersonClassification({ user: other, body: { vibe: 'warm' }, params: { id: String(by('Riya')._id) } } as any, res2);
  check('cannot edit someone else\'s person', res2.statusCode === 404);

  // ---------------- custom moods ----------------
  res = await call(me.createCustomMood, { label: 'Homesick', emoji: '🏠', score: 3 });
  check('add custom mood', res.statusCode === 201 && res.body.label === 'Homesick' && res.body.score === 3 && res.body.id, res.body);
  const raw = await User.findById(u._id).lean();
  check('custom mood name encrypted at rest', raw.customMoods[0].label !== 'Homesick' && decrypt(raw.customMoods[0].label) === 'Homesick');
  check('duplicate name rejected', (await call(me.createCustomMood, { label: 'homesick', emoji: '😢', score: 2 })).statusCode === 409);
  check('needs one emoji (not text / several)', (await call(me.createCustomMood, { label: 'Meh', emoji: 'abc', score: 5 })).statusCode === 400
    && (await call(me.createCustomMood, { label: 'Meh', emoji: '😐😐', score: 5 })).statusCode === 400);
  check('level must be 1–10', (await call(me.createCustomMood, { label: 'Meh', emoji: '😐', score: 11 })).statusCode === 400
    && (await call(me.createCustomMood, { label: 'Meh', emoji: '😐', score: 0 })).statusCode === 400);
  check('markup stripped from names', (await call(me.createCustomMood, { label: '<b>Cozy</b>', emoji: '☕', score: 8 })).body.label === 'Cozy');
  res = await call(me.getCustomMoods);
  check('list returns decrypted moods', res.body.length === 2 && res.body.some((m: any) => m.label === 'Homesick'));
  res = await call(me.removeCustomMood, {}, { id: res.body[0].id });
  check('delete custom mood', res.statusCode === 200 && (await call(me.getCustomMoods)).body.length === 1);
  for (let i = 0; i < 30; i++) await call(me.createCustomMood, { label: `Mood ${i}`, emoji: '🙂', score: 5 });
  check('capped at 24 custom moods', (await call(me.getCustomMoods)).body.length === 24);

  // ---------------- window-button preference ----------------
  check('default window buttons = windows', (await User.findById(u._id).lean()).windowControls === 'windows');
  res = await call(me.updatePreferences, { windowControls: 'mac' });
  check('switch to mac (synced on the account)', res.statusCode === 200 && (await User.findById(u._id).lean()).windowControls === 'mac');
  check('junk value rejected', (await call(me.updatePreferences, { windowControls: 'linux' })).statusCode === 400);
  // Sanctuary fonts (synced like window buttons)
  check('default fonts = jakarta + fraunces', (await User.findById(u._id).lean()).appFont === 'jakarta' && (await User.findById(u._id).lean()).headingFont === 'fraunces');
  res = await call(me.updatePreferences, { appFont: 'nunito', headingFont: 'playfair' });
  const fu: any = await User.findById(u._id).lean();
  check('font choice saved on the account', res.statusCode === 200 && fu.appFont === 'nunito' && fu.headingFont === 'playfair', res.body);
  check('unknown font rejected', (await call(me.updatePreferences, { appFont: 'comic-sans' })).statusCode === 400 && (await call(me.updatePreferences, { headingFont: 'x' })).statusCode === 400);
  // Sanctuary colour (preset or colour-wheel hex), synced on the account
  check('new account has no colour yet (it adopts the colour of the device)', !(await User.findById(u._id).lean()).themeColor);
  res = await call(me.updatePreferences, { themeColor: '#EEC64F' });
  check('colour-wheel hex saved (normalised)', res.statusCode === 200 && (await User.findById(u._id).lean()).themeColor === '#eec64f');
  check('preset saved', (await call(me.updatePreferences, { themeColor: 'ocean' })).statusCode === 200 && (await User.findById(u._id).lean()).themeColor === 'ocean');
  check('bad colours rejected (css injection, short hex)', (await call(me.updatePreferences, { themeColor: 'url(javascript:x)' })).statusCode === 400 && (await call(me.updatePreferences, { themeColor: '#fff' })).statusCode === 400);

  // ---------------- everything time-based is LOCAL ----------------
  const { updateStreak } = require(`${SRV}/utils/streak`);
  // New York user: 23:30 local on day 1, then 00:30 local on day 2 (only 1 h later) → streak +1 (local days, not server/IST days)
  const ny: any = { timeZone: 'America/New_York', streak: 3, lastVisit: new Date('2026-11-24T04:30:00Z') };
  updateStreak(ny, new Date('2026-11-24T05:30:00Z'));
  check('streak: next LOCAL day counts even 1 h later (New York)', ny.streak === 4, ny);
  const ny2: any = { timeZone: 'America/New_York', streak: 4, lastVisit: new Date('2026-11-24T05:30:00Z') };
  updateStreak(ny2, new Date('2026-11-24T20:00:00Z'));
  check('streak: same local day → unchanged', ny2.streak === 4, ny2);
  const ny3: any = { timeZone: 'America/New_York', streak: 9, lastVisit: new Date('2026-11-20T15:00:00Z') };
  updateStreak(ny3, new Date('2026-11-24T15:00:00Z'));
  check('streak: missed local days → back to 1', ny3.streak === 1);
  const rel = require(`${SRV}/services/relationship`);
  const b1 = rel.updateBond({ points: 0, level: 0 }, 'hi', new Date('2026-11-24T04:30:00Z'), 'America/New_York');
  const b2 = rel.updateBond(b1.state, 'hi again', new Date('2026-11-24T05:30:00Z'), 'America/New_York');
  check('closeness "new day" bonus uses the local day', b1.state.lastDayKey === '2026-11-23' && b2.state.lastDayKey === '2026-11-24' && b2.state.points > b1.state.points + 1, [b1.state, b2.state]);

  // ---------------- legal: adults only, recorded consent, re-consent, payment records kept ----------------
  const auth = require(`${SRV}/controllers/authController`);
  const legal = require(`${SRV}/legal`);
  const reg = async (body: any) => { const r = mockRes(); r.cookie = () => r; await auth.registerUser({ body } as any, r); return r; };
  const base = { name: 'Asha', email: 'asha@x.com', username: 'asha8', password: 'Passw0rd!x', diaryPassword: 'd1ary', securityQuestions: [{ question: 'q', answer: 'a' }] };
  const teen = new Date(); teen.setFullYear(teen.getFullYear() - 16);
  let rr = await reg({ ...base, dateOfBirth: teen.toISOString().slice(0, 10), acceptTerms: true });
  check('sign-up: under-18 rejected (DPDP s.9)', rr.statusCode === 400 && /18\+/.test(rr.body.message) && !(await User.findOne({ username: 'asha8' })));
  rr = await reg({ ...base, dateOfBirth: '2000-01-01' });
  check('sign-up: consent checkbox required', rr.statusCode === 400 && /Terms/.test(rr.body.message));
  rr = await reg({ ...base, dateOfBirth: '2000-01-01', acceptTerms: true });
  const asha = await User.findOne({ username: 'asha8' }).lean();
  check('sign-up: adult + consent → account with recorded consent (version + time)', [200, 201].includes(rr.statusCode) && asha?.legalConsent?.termsVersion === legal.TERMS_VERSION && !!asha?.legalConsent?.acceptedAt, rr.body);
  check('existing account without consent is flagged', legal.consentIsCurrent(undefined) === false && legal.consentIsCurrent({ termsVersion: 'old', privacyVersion: legal.PRIVACY_VERSION }) === false);
  res = await call(me.acceptLegal, { accept: true });
  check('re-consent recorded', res.statusCode === 200 && legal.consentIsCurrent((await User.findById(u._id).lean()).legalConsent));
  await User.updateOne({ _id: u._id }, { $set: { emailHash: 'hash-m8', paymentHistory: [{ orderId: 'order_1', paymentId: 'pay_1', amount: 4900, status: 'captured', date: new Date() }] } });
  const del = mockRes(); del.cookie = () => del; await auth.softDeleteUser({ user: u, body: { reason: 'test' } } as any, del);
  const { PaymentArchive } = require(`${SRV}/models/PaymentArchive`);
  const arch = await PaymentArchive.findOne({ emailHash: 'hash-m8' }).lean();
  check('account deletion keeps only bare payment records (tax law), user gone', del.statusCode === 200 && !(await User.findById(u._id)) && arch?.records?.[0]?.paymentId === 'pay_1' && !('name' in (arch || {})));

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
