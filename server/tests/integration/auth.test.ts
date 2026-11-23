/* Integration checks for auth hardening: purpose tokens, token revocation, OTP lockout. */
process.env.SERVER_ENCRYPTION_KEY = 'k';
process.env.JWT_SECRET = 'test-secret';

const SRV = require('path').resolve(__dirname, '../../src');
const NM = require('path').resolve(__dirname, '../../node_modules');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require(`${NM}/mongoose`);
const jwt = require(`${NM}/jsonwebtoken`);
const bcrypt = require(`${NM}/bcryptjs`);
const crypto = require('crypto');

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : extra);
  if (!cond) failures++;
};

const mockRes = () => {
  const r: any = { statusCode: 200, body: null, cookies: {} };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.cookie = (k: string, v: any) => { r.cookies[k] = v; return r; };
  return r;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require(`${SRV}/models/User`).default;
  const { protect } = require(`${SRV}/middleware/authMiddleware`);
  const auth = require(`${SRV}/controllers/authController`);
  const { encrypt } = require(`${SRV}/utils/serverEncryption`);

  const email = 'test@example.com';
  const user = await User.create({
    name: 'Test', username: 'tester', dateOfBirth: new Date('2000-01-01'),
    emailHash: crypto.createHash('sha256').update(email).digest('hex'),
    emailEncrypted: encrypt(email), passwordHash: await bcrypt.hash('pw', 4),
    isVerified: false, otpCode: await bcrypt.hash('123456', 4), otpExpires: new Date(Date.now() + 600000),
  });

  const runProtect = async (token: string) => {
    const req: any = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = mockRes(); let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    return { nextCalled, status: res.statusCode };
  };

  // 1. Purpose (reset) tokens can't log in
  const resetTok = jwt.sign({ id: user._id.toString(), purpose: 'reset-verified' }, 'test-secret', { expiresIn: '15m' });
  check('reset-verified token rejected by protect', !(await runProtect(resetTok)).nextCalled);

  // 2. Legacy token (no tv) still accepted while tokenVersion = 0
  const legacyTok = jwt.sign({ id: user._id.toString() }, 'test-secret', { expiresIn: '30d' });
  check('legacy token without tv accepted (no forced logout on deploy)', (await runProtect(legacyTok)).nextCalled);

  // 3. Revocation
  await User.updateOne({ _id: user._id }, { $set: { tokenVersion: 1 } });
  check('legacy token rejected after tokenVersion bump', !(await runProtect(legacyTok)).nextCalled);
  const v1Tok = jwt.sign({ id: user._id.toString(), tv: 1 }, 'test-secret');
  check('token with current tv accepted', (await runProtect(v1Tok)).nextCalled);

  // 4. OTP lockout on verifyOTP
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = mockRes();
    await auth.verifyOTP({ body: { email, otp: '000000' } }, res);
    statuses.push(res.statusCode);
  }
  check('5 wrong codes → 400, then locked (429)', JSON.stringify(statuses) === JSON.stringify([400, 400, 400, 400, 400, 429]), statuses);
  const resCorrect = mockRes();
  await auth.verifyOTP({ body: { email, otp: '123456' } }, resCorrect);
  check('even the correct code is refused once locked', resCorrect.statusCode === 429, resCorrect.statusCode);

  // 5. New code resets the counter; correct code then works and issues a tv token
  await User.updateOne({ _id: user._id }, { $set: { otpCode: await bcrypt.hash('654321', 4), otpExpires: new Date(Date.now() + 600000), otpAttempts: 0 } });
  const resOk = mockRes();
  await auth.verifyOTP({ body: { email, otp: '654321' } }, resOk);
  const issued = resOk.body?.token ? jwt.decode(resOk.body.token) : null;
  check('fresh code verifies and issued token carries tv=1', resOk.statusCode === 200 && issued?.tv === 1, [resOk.statusCode, issued]);

  await mongoose.disconnect();
  await mongod.stop();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
