/**
 * Key management CLI (docs/KEY_ROTATION.md)
 *   npm run keys:generate   print a fresh random secret (for ENCRYPTION_KEYS / BLIND_INDEX_KEYS / JWT_SECRET)
 *   npm run keys:status     what's stored under old keys / still plaintext (read-only)
 *   npm run keys:rotate     run the re-encryption sweep now (the server also does this by itself on start)
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const cmd = process.argv[2];

const main = async () => {
  if (cmd === 'generate') {
    console.log(crypto.randomBytes(32).toString('hex'));
    return;
  }
  if (cmd !== 'status' && cmd !== 'rotate') {
    console.log('usage: keys.ts generate | status | rotate');
    process.exit(1);
  }
  const { keyStatus, runKeyRotation } = await import('../services/keyRotation');
  const { encryptionKeys, blindKeys } = await import('../utils/serverEncryption');
  await mongoose.connect(process.env.MONGO_URI || '', { serverSelectionTimeoutMS: 10_000 });
  console.log(`encryption keys: ${encryptionKeys().map((k, i) => `${k.kid}${i === 0 ? ' (current)' : ''}`).join(', ')}`);
  console.log(`blind-index keys: ${blindKeys().map((k, i) => `${k.kid}${i === 0 ? ' (current)' : ''}`).join(', ')}`);
  if (cmd === 'rotate') {
    const stats = await runKeyRotation({ force: true });
    console.log(JSON.stringify(stats, null, 2));
  } else {
    const st = await keyStatus();
    let pending = 0, unreadable = 0;
    for (const [name, s] of Object.entries(st.perCollection)) {
      pending += s.pending; unreadable += s.unreadable;
      if (s.pending || s.unreadable) console.log(`  ${name}: ${s.pending} value(s) to update, ${s.unreadable} unreadable (of ${s.scanned} docs)`);
    }
    console.log(pending ? `→ ${pending} value(s) not on the current keys yet (the sweep fixes them; or run keys:rotate).` : '→ everything is on the current keys.');
    if (unreadable) console.log(`⚠️ ${unreadable} value(s) can't be opened by ANY configured key, an old key is missing. Don't remove keys until this is 0.`);
    else if (!pending) console.log('   Old keys (everything after the first in ENCRYPTION_KEYS / BLIND_INDEX_KEYS) can now be removed.');
    console.log(`last finished sweep: ${(st.state as any)?.finishedAt || 'never'}`);
  }
  await mongoose.disconnect();
};

main().catch(async (e) => { console.error(e?.message || e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
