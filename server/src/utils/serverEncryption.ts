import crypto from 'crypto';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

/**
 * Server-side encryption at rest (AES-256-GCM) with a KEYRING, so keys can be rotated without breaking anything.
 *
 * ── Keys (env) ───────────────────────────────────────────────────────────────────────────────────────────
 *   ENCRYPTION_KEYS            comma-separated secrets, NEWEST FIRST. The first one encrypts; all of them decrypt.
 *   NEW_SERVER_ENCRYPTION_KEY  legacy, still honoured (added after ENCRYPTION_KEYS)
 *   SERVER_ENCRYPTION_KEY      legacy, still honoured (added last)
 *
 *   BLIND_INDEX_KEYS           comma-separated, NEWEST FIRST — keyed hashes used for lookups (Web names, email).
 *   BLIND_INDEX_KEY            legacy single key. If no blind keys are set, SERVER_ENCRYPTION_KEY /
 *                              NEW_SERVER_ENCRYPTION_KEY is used (the historical default).
 *
 * ── Rotating (see docs/KEY_ROTATION.md) ──────────────────────────────────────────────────────────────────
 *   1. `npm run keys:generate` → put the new secret FIRST in ENCRYPTION_KEYS, keep the old ones after it.
 *   2. Restart. New writes use the new key immediately; services/keyRotation.ts re-encrypts every stored
 *      value in the background (resumable, batched). `npm run keys:status` shows what's left.
 *   3. When status says 0 left, remove the old secret.
 *
 * ── Ciphertext format ────────────────────────────────────────────────────────────────────────────────────
 *   v2:<kid>:<iv>:<tag>:<data>   kid = 8-hex fingerprint of the key (not secret), so decrypt picks the right key
 *   <iv>:<tag>:<data>            legacy (no kid) — every key is tried. Re-written as v2 by the rotation sweep.
 */

const ALGORITHM = 'aes-256-gcm';

export interface KeyEntry { kid: string; key: Buffer }

const splitList = (v?: string) => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const fingerprint = (key: Buffer, label: string) => crypto.createHmac('sha256', key).update(`aastha-kid:${label}`).digest('hex').slice(0, 8);

let cache: { sig: string; enc: KeyEntry[]; blind: KeyEntry[] } | null = null;

const load = () => {
    const encSecrets = [...splitList(process.env.ENCRYPTION_KEYS), process.env.NEW_SERVER_ENCRYPTION_KEY, process.env.SERVER_ENCRYPTION_KEY]
        .filter((s): s is string => !!s && !!String(s).trim()).map(s => String(s).trim());
    let blindSecrets = [...splitList(process.env.BLIND_INDEX_KEYS), process.env.BLIND_INDEX_KEY]
        .filter((s): s is string => !!s && !!String(s).trim()).map(s => String(s).trim());
    // Historical default: the blind index used SERVER_ENCRYPTION_KEY (then NEW_). Keep that so old hashes still match.
    const legacyBlind = process.env.SERVER_ENCRYPTION_KEY || process.env.NEW_SERVER_ENCRYPTION_KEY;
    if (!blindSecrets.length && legacyBlind) blindSecrets = [legacyBlind];
    else if (legacyBlind && !process.env.BLIND_INDEX_KEY && !blindSecrets.includes(legacyBlind)) blindSecrets.push(legacyBlind); // old hashes still found

    const sig = JSON.stringify([encSecrets, blindSecrets]);
    if (cache && cache.sig === sig) return cache;
    if (!encSecrets.length) throw new Error('FATAL: No encryption keys (set ENCRYPTION_KEYS, or the legacy NEW_SERVER_ENCRYPTION_KEY / SERVER_ENCRYPTION_KEY).');

    const dedupe = (list: string[], derive: (s: string) => Buffer, label: string): KeyEntry[] => {
        const out: KeyEntry[] = [];
        for (const s of list) {
            const key = derive(s);
            const kid = fingerprint(key, label);
            if (!out.some(e => e.kid === kid)) out.push({ kid, key });
        }
        return out;
    };
    cache = {
        sig,
        enc: dedupe(encSecrets, s => crypto.createHash('sha256').update(s).digest(), 'enc'),
        // blind keys are used raw as HMAC secrets (exactly as before, so existing hashes keep matching)
        blind: dedupe(blindSecrets, s => Buffer.from(s, 'utf8'), 'blind'),
    };
    return cache;
};

/** The keyring (current key first). */
export const encryptionKeys = (): KeyEntry[] => load().enc;
export const currentKeyId = (): string => load().enc[0].kid;
export const blindKeys = (): KeyEntry[] => load().blind;
export const currentBlindKeyId = (): string => load().blind[0]?.kid || '';

const V2 = /^v2:([0-9a-f]{8}):([0-9a-f]{32}):([0-9a-f]{32}):([0-9a-f]*)$/i;
const LEGACY = /^([0-9a-f]{32}):([0-9a-f]{32}):([0-9a-f]+)$/i;

export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        const { kid, key } = encryptionKeys()[0];
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let enc = cipher.update(text, 'utf8', 'hex');
        enc += cipher.final('hex');
        return `v2:${kid}:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
    } catch (error) {
        // Fail closed: never store plaintext by accident.
        console.error('CRITICAL: Encryption Service Failed:', error);
        throw new Error('Security Violation: Encryption failed.');
    }
};

const tryDecrypt = (key: Buffer, ivHex: string, tagHex: string, dataHex: string): string | null => {
    try {
        const d = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
        d.setAuthTag(Buffer.from(tagHex, 'hex'));
        let out = d.update(dataHex, 'hex', 'utf8');
        out += d.final('utf8');
        return out;
    } catch { return null; }
};

let failures = 0;
const reportFailure = (why: string) => {
    failures++;
    // loud but not spammy: a missing old key shows up immediately in the logs
    if (failures <= 5 || failures % 1000 === 0) {
        console.error(`[encryption] DECRYPT FAILED (${why}) — is a key missing from ENCRYPTION_KEYS? (${failures} so far)`);
    }
};
export const decryptFailureCount = () => failures;

/**
 * Decrypts with the right key. Returns { ok, text, kid }:
 *  - not ciphertext → ok:true, text unchanged, kid:null (plaintext / legacy unencrypted value)
 *  - ciphertext we can open → ok:true, kid = key it was written with
 *  - ciphertext no key opens → ok:false
 */
export const decryptDetailed = (text: string): { ok: boolean; text: string; kid: string | null; legacy?: boolean } => {
    if (!text || typeof text !== 'string') return { ok: true, text, kid: null };
    const keys = encryptionKeys();
    let m = V2.exec(text);
    if (m) {
        const entry = keys.find(k => k.kid === m![1].toLowerCase());
        const out = entry ? tryDecrypt(entry.key, m[2], m[3], m[4]) : null;
        if (out !== null) return { ok: true, text: out, kid: entry!.kid };
        return { ok: false, text, kid: m[1].toLowerCase() };
    }
    m = LEGACY.exec(text);
    if (m) {
        for (const k of keys) {
            const out = tryDecrypt(k.key, m[1], m[2], m[3]);
            if (out !== null) return { ok: true, text: out, kid: k.kid, legacy: true };
        }
        return { ok: false, text, kid: null, legacy: true };
    }
    return { ok: true, text, kid: null };
};

/** Decrypt, or return the input unchanged if it isn't ciphertext (safe to call on plaintext / already-decrypted values). */
export const decrypt = (text: string): string => {
    const r = decryptDetailed(text);
    if (!r.ok) reportFailure(r.kid ? `key ${r.kid} not in keyring` : 'legacy value, no key matched');
    return r.text;
};

/** True if the string looks like our ciphertext (either format). */
export const isEncrypted = (text: string): boolean =>
    typeof text === 'string' && (V2.test(text) || LEGACY.test(text));

/** True when `text` is ciphertext NOT written with the current key (or in the legacy format) and we can open it. */
export const needsReencryption = (text: string): boolean => {
    if (!text || !isEncrypted(text)) return false;
    const r = decryptDetailed(text);
    return r.ok && (!!r.legacy || r.kid !== currentKeyId());
};

/** Re-encrypt one value with the current key. Returns null when nothing needs doing (or it can't be opened). */
export const reencrypt = (text: string): string | null => {
    if (!needsReencryption(text)) return null;
    return encrypt(decryptDetailed(text).text);
};

/** Encrypt only if not already ciphertext (idempotent — used by Mongoose setters). */
export const ensureEncrypted = (text: any): any => {
    if (text === null || text === undefined || text === '') return text;
    const s = String(text);
    return isEncrypted(s) ? s : encrypt(s);
};

// ── Blind indexes ────────────────────────────────────────────────────────────────────────────────────────
const normalise = (value: string) => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Blind index: a keyed hash (HMAC-SHA256) of a normalised value, so encrypted fields can still be looked up
 * / de-duplicated without storing the value. Always computed with the CURRENT blind key.
 */
export const blindIndex = (value: string): string => {
    const k = blindKeys()[0];
    if (!k) throw new Error('FATAL: no key available for blind index');
    return crypto.createHmac('sha256', k.key).update(normalise(value)).digest('hex');
};

/** Hashes under EVERY blind key (current first) — query with `$in` so lookups keep working mid-rotation. */
export const blindIndexCandidates = (value: string): string[] => {
    const n = normalise(value);
    return [...new Set(blindKeys().map(k => crypto.createHmac('sha256', k.key).update(n).digest('hex')))];
};
