import mongoose from 'mongoose';
import {
  currentKeyId, currentBlindKeyId, encrypt, decrypt, decryptDetailed, isEncrypted, reencrypt, ensureEncrypted, blindIndex,
} from '../utils/serverEncryption';

/**
 * Key rotation sweep — moves EVERYTHING stored onto the current keys, in the background, without downtime.
 *
 * One pass over every collection (raw driver, batched, resumable after a restart) does three things:
 *   1. re-encrypts every ciphertext not written with the current key (any field, any depth — new fields are
 *      covered automatically), and upgrades the legacy `iv:tag:data` format to `v2:<kid>:…`;
 *   2. encrypts known plaintext fields left over from older versions (PLAIN_FIELDS below; versioned);
 *   3. recomputes blind indexes (Web names, email lookup hash) when the blind-index key changed.
 *
 * Every write is conditional on the old value (`{_id, path: old}`), so a value the app changed meanwhile is
 * never overwritten. Ciphertext that no configured key can open is left untouched and counted as `unreadable`.
 *
 * Runs on server start (when the keys changed since the last finished pass) and via `npm run keys:rotate`.
 */

/** Bump when PLAIN_FIELDS changes so the next start encrypts the newly listed fields. */
export const PLAIN_FIELDS_VERSION = 1;

/** Fields that older versions stored as plaintext. `$` = every array element. */
const PLAIN_FIELDS: Record<string, string[]> = {
  users: ['name', 'region', 'avatar', 'wallpaper', 'lore.$.topic', 'lore.$.description', 'openLoops.$.event', 'mirrorEntries.$.content'],
  traininglogs: ['input', 'output'],
};

const STATE_COLLECTION = 'keyrotationstate';
const BATCH = 200;

export interface RotationStats {
  scanned: number; reencrypted: number; encryptedPlain: number; reindexed: number; unreadable: number; removedPlainEmail: number;
}
type Target = { encKid: string; blindKid: string; plainV: number };

const target = (): Target => ({ encKid: currentKeyId(), blindKid: currentBlindKeyId(), plainV: PLAIN_FIELDS_VERSION });
const sameTarget = (a: any, b: Target) => !!a && a.encKid === b.encKid && a.blindKid === b.blindKid && a.plainV === b.plainV;

const isPlainObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
  && !(v instanceof mongoose.Types.ObjectId) && !(v?._bsontype) && !Buffer.isBuffer(v);

/** Walk a raw document; collect `path → new ciphertext` for every value on an old key. */
const collectRewraps = (value: any, path: string, out: { path: string; old: string; next: string }[], stats: RotationStats) => {
  if (typeof value === 'string') {
    if (!isEncrypted(value)) return;
    const r = decryptDetailed(value);
    if (!r.ok) { stats.unreadable++; return; }
    const next = reencrypt(value);
    if (next) out.push({ path, old: value, next });
    return;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => collectRewraps(v, path ? `${path}.${i}` : String(i), out, stats)); return; }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value)) {
      if (k === '_id') continue;
      collectRewraps(value[k], path ? `${path}.${k}` : k, out, stats);
    }
  }
};

/** Expand `lore.$.topic` against a document into concrete paths with their values. */
const expand = (doc: any, pattern: string): { path: string; value: any }[] => {
  const parts = pattern.split('.');
  const walk = (node: any, i: number, prefix: string): { path: string; value: any }[] => {
    if (i === parts.length) return [{ path: prefix, value: node }];
    if (node === null || node === undefined) return [];
    const p = parts[i];
    if (p === '$') return Array.isArray(node) ? node.flatMap((el, j) => walk(el, i + 1, `${prefix}.${j}`)) : [];
    return walk(node[p], i + 1, prefix ? `${prefix}.${p}` : p);
  };
  return walk(doc, 0, '');
};

type Op = { filter: any; update: any };

const opsForDoc = (coll: string, doc: any, stats: RotationStats): Op[] => {
  const ops: Op[] = [];
  const rewraps: { path: string; old: string; next: string }[] = [];

  // 1. re-encrypt (generic)
  if (coll === 'voicenotes') {
    // audio bytes are stored as Buffer(utf8 of ciphertext) — the generic walker only sees strings
    const buf: Buffer | null = doc.buffer?.buffer ? Buffer.from(doc.buffer.buffer) : (Buffer.isBuffer(doc.buffer) ? doc.buffer : null);
    if (buf) {
      if (doc.encrypted) {
        const next = reencrypt(buf.toString('utf8'));
        if (next) ops.push({ filter: { _id: doc._id, encrypted: true }, update: { $set: { buffer: Buffer.from(next, 'utf8') } } });
        else if (!decryptDetailed(buf.toString('utf8')).ok) stats.unreadable++;
      } else {
        // Aastha's TTS replies used to be stored plain
        ops.push({ filter: { _id: doc._id, encrypted: { $ne: true } }, update: { $set: { buffer: Buffer.from(encrypt(buf.toString('base64')), 'utf8'), encrypted: true } } });
        stats.encryptedPlain++;
      }
    }
    return ops;
  }
  collectRewraps(doc, '', rewraps, stats);
  for (const r of rewraps) {
    ops.push({ filter: { _id: doc._id, [r.path]: r.old }, update: { $set: { [r.path]: r.next } } });
    stats.reencrypted++;
  }

  // 2. plaintext leftovers
  for (const pattern of PLAIN_FIELDS[coll] || []) {
    for (const { path, value } of expand(doc, pattern)) {
      if (typeof value !== 'string' || !value || isEncrypted(value)) continue;
      ops.push({ filter: { _id: doc._id, [path]: value }, update: { $set: { [path]: encrypt(value) } } });
      stats.encryptedPlain++;
    }
  }

  if (coll === 'users') {
    // date of birth: BSON Date / plain string → encrypted ISO date
    const dob = doc.dateOfBirth;
    if (dob && !(typeof dob === 'string' && isEncrypted(dob))) {
      const d = new Date(dob);
      ops.push({ filter: { _id: doc._id, dateOfBirth: dob }, update: isNaN(d.getTime()) ? { $unset: { dateOfBirth: '' } } : { $set: { dateOfBirth: encrypt(d.toISOString()) } } });
      stats.encryptedPlain++;
    }
    // plaintext email: keep only the encrypted copy
    if (typeof doc.email === 'string' && doc.email) {
      const set: any = {};
      if (!doc.emailEncrypted) set.emailEncrypted = encrypt(doc.email.toLowerCase().trim());
      if (!doc.emailHash) set.emailHash = blindIndex(doc.email.toLowerCase().trim());
      ops.push({ filter: { _id: doc._id, email: doc.email }, update: { ...(Object.keys(set).length ? { $set: set } : {}), $unset: { email: '' } } });
      stats.removedPlainEmail++;
    }
    // 3. email blind index under the current key
    if (doc.emailEncrypted) {
      const r = decryptDetailed(doc.emailEncrypted);
      if (r.ok && r.text) {
        const h = blindIndex(r.text.toLowerCase().trim());
        if (h !== doc.emailHash) { ops.push({ filter: { _id: doc._id, emailHash: doc.emailHash ?? null }, update: { $set: { emailHash: h } } }); stats.reindexed++; }
      }
    }
  }
  if (coll === 'people' && doc.name) {
    const r = decryptDetailed(doc.name);
    if (r.ok && r.text) {
      const h = blindIndex(r.text);
      if (h !== doc.nameHash) { ops.push({ filter: { _id: doc._id, nameHash: doc.nameHash ?? null }, update: { $set: { nameHash: h } } }); stats.reindexed++; }
    }
  }
  return ops;
};

let running: Promise<RotationStats> | null = null;

const emptyStats = (): RotationStats => ({ scanned: 0, reencrypted: 0, encryptedPlain: 0, reindexed: 0, unreadable: 0, removedPlainEmail: 0 });

/** Run (or resume) the sweep. Safe to call concurrently — the second caller gets the same promise. */
export const runKeyRotation = (opts: { force?: boolean; log?: (m: string) => void } = {}): Promise<RotationStats> => {
  if (running) return running;
  running = (async () => {
    const log = opts.log || ((m: string) => console.log(`[keys] ${m}`));
    const db = mongoose.connection.db;
    if (!db) throw new Error('database not connected');
    const stateColl = db.collection(STATE_COLLECTION);
    const want = target();
    const state: any = await stateColl.findOne({ _id: 'main' as any });
    if (!opts.force && sameTarget(state?.done, want)) return emptyStats();

    // resume only if the same target was in progress
    const progress: Record<string, string> = sameTarget(state?.inProgress, want) ? (state.progress || {}) : {};
    await stateColl.updateOne({ _id: 'main' as any }, { $set: { inProgress: want, progress, startedAt: state?.startedAt && sameTarget(state?.inProgress, want) ? state.startedAt : new Date() } }, { upsert: true });
    log(`sweep → enc key ${want.encKid}, blind key ${want.blindKid}${Object.keys(progress).length ? ' (resuming)' : ''}`);

    const stats = emptyStats();
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c: any) => c.name).filter((n: string) => !n.startsWith('system.') && n !== STATE_COLLECTION).sort();

    for (const name of collections) {
      if (progress[name] === 'done') continue;
      const coll = db.collection(name);
      let lastId: any = progress[name] ? (mongoose.isValidObjectId(progress[name]) ? new mongoose.Types.ObjectId(progress[name]) : progress[name]) : null;
      for (;;) {
        const docs = await coll.find(lastId ? { _id: { $gt: lastId } } : {}).sort({ _id: 1 }).limit(BATCH).toArray();
        if (!docs.length) break;
        const ops: Op[] = [];
        for (const d of docs) { stats.scanned++; ops.push(...opsForDoc(name, d, stats)); }
        if (ops.length) {
          try {
            await coll.bulkWrite(ops.map(o => ({ updateOne: o })), { ordered: false });
          } catch (e: any) {
            // duplicate blind index (two rows that are really the same person) etc. — keep going, log it
            log(`${name}: ${e?.writeErrors?.length || 1} write(s) skipped (${e?.code || e?.message})`);
          }
        }
        lastId = docs[docs.length - 1]._id;
        await stateColl.updateOne({ _id: 'main' as any }, { $set: { [`progress.${name}`]: String(lastId) } });
      }
      await stateColl.updateOne({ _id: 'main' as any }, { $set: { [`progress.${name}`]: 'done' } });
    }

    await stateColl.updateOne({ _id: 'main' as any }, { $set: { done: want, finishedAt: new Date(), lastStats: stats }, $unset: { inProgress: '', progress: '' } });
    log(`sweep finished: ${JSON.stringify(stats)}`);
    if (stats.unreadable) log(`⚠️ ${stats.unreadable} value(s) could not be opened with any key — an old key is missing from ENCRYPTION_KEYS. Do NOT delete old keys until this is 0.`);
    return stats;
  })().finally(() => { running = null; });
  return running;
};

/** Count what is NOT yet on the current keys (read-only; for `npm run keys:status`). */
export const keyStatus = async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('database not connected');
  const perCollection: Record<string, RotationStats & { pending: number }> = {};
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c: any) => c.name).filter((n: string) => !n.startsWith('system.') && n !== STATE_COLLECTION).sort();
  for (const name of collections) {
    const s = emptyStats();
    let pending = 0;
    for await (const d of db.collection(name).find({})) {
      s.scanned++;
      pending += opsForDoc(name, d, s).length;
    }
    perCollection[name] = { ...s, pending };
  }
  const state = await db.collection(STATE_COLLECTION).findOne({ _id: 'main' as any });
  return { currentKey: currentKeyId(), currentBlindKey: currentBlindKeyId(), state, perCollection };
};

/** Start the sweep shortly after the DB connects (never blocks startup; errors are logged, retried next boot). */
export const scheduleKeyRotation = () => {
  if (process.env.KEY_ROTATION_ON_START === 'false') return;
  const start = () => setTimeout(() => runKeyRotation().catch(e => console.error('[keys] sweep failed:', e?.message || e)), 5_000);
  if (mongoose.connection.readyState === 1) start();
  else mongoose.connection.once('connected', start);
};

// re-exported for tests
export { decrypt, ensureEncrypted };
