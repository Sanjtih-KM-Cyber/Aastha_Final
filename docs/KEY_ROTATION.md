# Changing encryption keys

You can change any key at any time. The app keeps working while it moves your data onto the new key by itself.
Code: `server/src/utils/serverEncryption.ts` (keyring), `server/src/services/keyRotation.ts` (sweep), `server/src/utils/jwtKeys.ts` (JWT).

## The keys

| Env var | What it protects | Format |
|---|---|---|
| `ENCRYPTION_KEYS` | Everything encrypted at rest (chats, diary, moods, memories, The Web, profile, voice notes…) | comma-separated, **newest first** |
| `BLIND_INDEX_KEYS` | Keyed hashes for lookups (email login, Web names) | comma-separated, **newest first** |
| `JWT_SECRET` (+ `JWT_SECRET_OLD`) | Login sessions | one current secret, plus old secrets still accepted |
| `SERVER_ENCRYPTION_KEY` / `NEW_SERVER_ENCRYPTION_KEY` / `BLIND_INDEX_KEY` | Legacy names. They still work and count as the oldest keys. | single value |

The first key in a list does the encrypting. Every key in the list can decrypt. Each stored value records which key wrote it (`v2:<key-id>:…`), so the right key is used straight away.

## Rotate the encryption key

1. Run `npm run keys:generate` in `server/` and copy the output.
2. Set `ENCRYPTION_KEYS=<new>,<old>`. If you only had `SERVER_ENCRYPTION_KEY` before, set `ENCRYPTION_KEYS=<new>` and **leave `SERVER_ENCRYPTION_KEY` in place** for now.
3. Redeploy or restart. New data uses the new key straight away. About 5 seconds after start, the server re-encrypts all stored data with the new key in the background. The sweep runs in batches, resumes if the server restarts, and never overwrites a value the app changed while it ran.
4. Check progress with `npm run keys:status` (it needs `MONGO_URI`). Use `npm run keys:rotate` to run the sweep immediately.
5. When the status shows **0 to update and 0 unreadable**, remove the old key.

⚠️ Never remove an old key while `keys:status` still reports values for it, or while it reports any **unreadable** values. Those can only be opened by a key you no longer have configured. When decryption fails, the app logs `[encryption] DECRYPT FAILED` and returns the stored value unchanged. It never garbles or deletes data.

## Rotate the blind-index key

1. Set `BLIND_INDEX_KEYS=<new>,<old>`. If you never set one, the old key is your `SERVER_ENCRYPTION_KEY`, and it is kept as the old blind key automatically.
2. Restart. Lookups try every blind key, so login and The Web keep working. The sweep recomputes every hash with the new key.
3. When `keys:status` shows 0, remove the old blind key.

> Best practice: set `BLIND_INDEX_KEYS` explicitly once, so that rotating `ENCRYPTION_KEYS` never touches the lookup hashes.

## Rotate the JWT secret

1. Set `JWT_SECRET=<new>` and `JWT_SECRET_OLD=<previous>`.
2. Restart. New logins get tokens signed with the new secret, and existing sessions keep working.
3. After 30 days (the session lifetime), remove `JWT_SECRET_OLD`.

To log **everyone out immediately** (for example after a leak), change `JWT_SECRET` **without** setting `JWT_SECRET_OLD`.

## What is encrypted

- **Encrypted (AES-256-GCM):**
  - Chats, voice-note transcripts, diary (also encrypted on the device with the user's own key), mood names and keywords, memories, facts and follow-ups.
  - People in The Web: name, alias, facts, photo and custom role.
  - Custom moods, Clone Mode style, voice sample and consent name.
  - **Profile:** name, email, date of birth, city/region, profile picture, wallpaper.
  - **All voice notes**, both the user's and Aastha's text-to-speech replies.
  - Donated training pairs.
  - Legacy memory fields (lore, open loops, mirror).
- **Stored only as keyed hashes:** email (used for login lookup) and Web names (used to de-duplicate).
- **Not encrypted, on purpose** (the app must read or search them, and they hold no free text):
  - Username (login handle) and plan or payment status.
  - Timestamps, mood levels, the Web role and vibe enum, reaction emoji.
  - Settings, push subscriptions (browser endpoint URLs), security-question **text** (answers are hashed).
- Passwords, the diary password and security answers are **hashed** (bcrypt), never encrypted.

## Options

- `KEY_ROTATION_ON_START=false` stops the sweep from running automatically on start. Use `npm run keys:rotate` instead.
