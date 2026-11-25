# Aastha — Issues & Plan of Action

> Living document. Update the status column / checkboxes as work lands.
> Session-to-session context lives in [HANDOFF.md](HANDOFF.md).
> Created: 2026-11-19 · Source: full code review (server, client, brain_server, APKs).

Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low

---

## 0. Product facts (source of truth)

| Item | Price | Duration | Status in code |
|---|---|---|---|
| Pro ("Early Bird") | ₹49 | 1 month (30 days) | ✅ 30 days in `paymentController.ts` |
| Voice Pass | ₹19 | **1 day** | ❌ Code + UI say **3 days**, and the pass is **never checked** when generating voice |
| Free tier | — | daily | 16 messages/day, 2 voice notes/day (per code) |

Personas: **Aastha** (female) and **Aastik** (male). Goal personality: *an introvert's best friend* — cordial at first, grows into a bestie over time, adapts to the user's texting style.

Deployments: web on Vercel (`aasthaai.site`), API on Render (`aastha-final.onrender.com`), voice/vision on Hugging Face Space (`sking0123-aastha-voice.hf.space`), Android via Capacitor (`com.soullink.aastha`).

---

## 1. Issue register

### A. Security, money & trust
| ID | Issue | Where | Sev |
|---|---|---|---|
| S1 | ~~`POST /api/users/upgrade` grants Pro to any logged-in user~~ — removed in Phase −1 | `authController.ts`, `routes/authRoutes.ts` | ✅ |
| S2 | `verifyPayment` trusts client `planType` (pay ₹19 → claim Pro), no order-ownership check, payment IDs reusable | `server/src/controllers/paymentController.ts` | ✅ Phase 0 |
| S3 | Groq API keys shipped in the web bundle (`VITE_GROQ_API_KEYS`, `dangerouslyAllowBrowser`) — **keys must be rotated** | `client/src/services/groqService.ts` | ✅ Phase 0 (rotate keys: owner) |
| S16 | Voice Pass (`voiceTopUpExpires`) is never read; buyers get no extra voice | `chatController.ts` (`hasVoiceQuota`) | ✅ Phase 0 |
| S17 | Voice Pass duration is 3 days in server + UI; should be 1 day | `paymentController.ts`, `client/src/components/settings/SettingsPanel.tsx` | ✅ Phase 0 |
| S4 | Brain server has no auth; leaks exception text | `brain_server/app.py` | ✅ Phase 0 |
| S5 | OTP verification has no attempt limit | `authController.ts` | ✅ Phase 1 |
| S6 | 30-day JWT, no revocation; logout only clears cookie | `authController.ts`, `middleware/authMiddleware.ts` | ✅ Phase 1 |
| S7 | "The Web": third-party names/mugshots stored in plaintext; unescaped `RegExp` on name | `models/Person.ts`, `services/detectiveService.ts` | ✅ Phase 6 |
| S8 | "Zero-knowledge/anonymous" claim is false (server decrypts) | README, landing/UI copy | ✅ Phase 6 |
| S9 | Crisis detection is keyword-only; false positives ("dying to…"), misses indirect phrasing | `chatController.ts` `RED_FLAG_KEYWORDS` | ✅ Phase 3 |
| S10 | JWT stored in `localStorage`/`sessionStorage` (XSS-stealable) | `client/src/services/api.ts`, `AuthContext.tsx` | 🟡 |
| S11 | `/api/ai/stream/:id` serves voice notes unauthenticated | `routes/aiRoutes.ts` | 🟡 |
| S12 | Error handler returns `err.message`; chat returns `'Chat failed: ' + message` | `app.ts`, `chatController.ts` | 🟡 |
| S13 | Diary `moodKeywords` stored unencrypted | `models/Diary.ts` | ✅ Phase 6 |
| S14 | Gender inferred from name, injected into prompts | `services/geminiService.ts` | ✅ Phase 2 |
| S15 | Placeholder keys (`re_123456789`, `dummy`) mask misconfig; CSP has `unsafe-eval`, `ws:` wildcard | `emailService.ts`, `groqService.ts`, `app.ts` | ⚪ |
| S18 | Payment history records voice pass as 2500 paise (should be 1900) | `paymentController.ts` | ✅ Phase 0 |
| S22 | ~~Diary "nuclear reset" endpoint wiped the diary with no server-side verification~~ — replaced by verified reset (2026-11-20) | `authRoutes.ts`, `diaryController.ts` | ✅ |
| S23 | ~~OTP codes + emails logged to the console in production~~ — dev-only now | `services/emailService.ts` | ✅ |
| S24 | ~~`verify-security-answer` allowed unlimited guessing~~ — removed; diary reset shares a 5-try / 15-min lockout | `authRoutes.ts`, `diaryController.ts` | ✅ |
| S20 | ~~Password-reset token (after OTP, before security answer) accepted as a login token by `protect`~~ — fixed in Phase 1 | `middleware/authMiddleware.ts`, `services/socketService.ts` | ✅ |
| S21 | ~~Crisis reply sent as plain JSON on an SSE stream → app silently dropped the helpline message~~ — fixed Phase 3 | `chatController.ts` | ✅ |
| S19 | ~~`vite.config.ts` `define` injected `GEMINI_API_KEY` into client~~ — fixed in Phase −1 | `client/vite.config.ts` | ✅ |

### B. Backend reliability (Render failure emails)
| ID | Issue | Sev |
|---|---|---|
| R1 | No `unhandledRejection` / `uncaughtException` handlers | ✅ Phase 0 |
| R2 | `db.ts` calls `process.exit(1)` on Mongo connect failure; no disconnect handling | ✅ Phase 0 |
| R3 | Render free tier sleeps → 30–60 s cold starts; node-cron unreliable | 🟠 |
| R4 | Whole chat is one Mongo document (`Chat.messages[]`) → 16 MB limit | ✅ Phase 1 |
| R5 | `getChatHistory` decrypts entire history; client keeps last 50 | ✅ Phase 1 |
| R6 | Login does up to 4 saves; key-rotation check always true (random IV); `bcryptjs` is slow | ✅ Phase 1 |
| R7 | `protect` middleware writes to DB on requests (daily reset / expiry) | ✅ Phase 1 |
| R8 | Daily reset in 3 places, different timezones (server local vs IST) | ✅ Phase 1 |
| R9 | Pro expiry uses `subscriptionDate` (middleware) vs `subscriptionExpiresAt` (payments) — stacked plans cut short | ✅ Phase 0 |
| R10 | Voice notes stored as Buffers in Mongo; 10 MB JSON bodies | 🟡 |
| R14 | ~~API crashed at startup without Razorpay keys~~ — fixed Phase 5 | ✅ |
| R15 | ~~History reads shared the chat-send rate limit → sent messages could get 429~~ — fixed Phase 5 | ✅ |
| R16 | ~~Offline diary/mood sync retry storm (one queued copy per autosave, whole queue re-posted on every focus → hundreds of 429s)~~ — fixed 7.1 (`services/offlineQueue.ts`) | ✅ |
| R17 | ~~"Messages left" count lagged by one (server read the count before incrementing)~~ — fixed 7.1 | ✅ |
| R12 | Fire-and-forget tasks (memory, donation, email) fail silently | ⚪ |
| R13 | Root `package.json` conflicts with server (Express 5 vs 4, Mongoose 9 vs 8) | ⚪ |

### C. AI brain & personality
| ID | Issue | Sev |
|---|---|---|
| A1 | Groq limits are per org, so multiple keys from one account don't add capacity; on 429 it retries up to 9× with no backoff | ✅ Phase 2 |
| A2 | 2–3 LLM calls per message (subconscious + reply + memory every 5th) | ✅ Phase 2 |
| A3 | `llama-3.1-8b-instant` used for voice mode and as last fallback → hallucinations | ✅ Phase 2 |
| A4 | Memory summary rewritten every 5 msgs from last 20 → drift; `newFacts` never saved | ✅ Phase 2 |
| A5 | ~200-line contradictory prompt; examples parroted; pet names from message 1 | ✅ Phase 2 |
| A6 | No bond progression, no user-style mirroring | ✅ Phase 3 |
| A7 | Mid-stream failure restarts on another model → duplicated text | ✅ Phase 2 |
| A8 | `qwen3-32b` without `reasoning_format` → `<think>` content likely leaks | ✅ Phase 2 |
| A9 | No region/language preference; mixed regional slang; server clock fallback | ✅ Phase 3 |
| A10 | Ghost service sets `moodStatus='mad'` (guilt-trip); login forces `happy` | ✅ Phase 2 |
| A11 | YouTube Data API search ≈100 searches/day app-wide → Jam breaks at scale | ✅ Phase 6 |
| A12 | Clone mode not wired (imports unused, voice sample never sent, screenshot discarded) | ✅ Phase 6 (Clone v1) |
| A14 | ~~Image messages flattened to text before reaching any model~~ — fixed Phase 2 | ✅ |
| A15 | ~~Random per-message tone flavor made personality inconsistent~~ — fixed Phase 2 | ✅ |
| A16 | ~~Brain tool calls re-requested in the prompt AND rendered by the app → duplicate proposals~~ — fixed Phase 3 | ✅ |
| A13 | No consent flow for cloning a voice/persona | ✅ Phase 6 (Clone v1) |

### D. Voice
| ID | Issue | Sev |
|---|---|---|
| V1 | Kokoro Hindi voice `hf_alpha` with `lang="en-us"` → robotic | ✅ Phase 3 |
| V2 | Two engines (Kokoro vs Indic Parler) → voice changes between notes | ✅ Phase 3 |
| V3 | `[STYLE:]` / `[TTS:]` tags: requested only via a Voice-Director prefix and used inconsistently → now a single instruction + server-side capture (Phase 2); voice consistency itself is Phase 3 | 🟡 |
| V4 | F5 clone writes shared `temp_ref.wav` → concurrent requests clash | ✅ Phase 3 |
| V5 | Parler on CPU slow; 120 s timeout holds SSE open | 🟡 |
| V7 | ~~`[TTS: …]` native-script copy shown to users mid-stream~~ — fixed Phase 2 | ✅ |
| V8 | ~~Whisper forced to English~~ — fixed Phase 2 | ✅ |
| V6 | Text truncated at 2000 chars mid-sentence | ✅ Phase 3 |

### E. Mobile & notifications
| ID | Issue | Sev |
|---|---|---|
| M1 | Committed APKs are stale builds; debug APK has **zero** native plugins; plus APK lacks background-mode | ✅ Phase 4 |
| M2 | "Connecting to Aastha…" blocks UI on `/chat/history` (cold start + full decrypt) | ✅ Phase 1 |
| M3 | `scheduleGhostNotifications` / `scheduleDailyReminders` cancel *all* pending notifications | ✅ Phase 4 |
| M4 | Server push: Web Push (VAPID) done for website/PWA in Phase 4; native app push still needs Firebase/FCM | 🟡 |
| M5 | No `SCHEDULE_EXACT_ALARM` permission (Android 12+) | ✅ Phase 4 |
| M6 | Chat bubble overflows right edge on narrow phones | ✅ Phase 4 |
| M7 | Mobile UX built from scattered `innerWidth < 768` checks → inconsistent | ✅ Phase 5 (chat + shell; landing/settings later) |
| M8 | Wallpaper legibility (60% overlay over photos) | ✅ Phase 4 |
| M9 | Notification `smallIcon` `ic_stat_icon_config_sample` doesn't exist | ✅ Phase 4 |
| M11 | ~~Chat stuck on "Connecting…" under React StrictMode~~ — fixed Phase 5 | ✅ |
| M12 | ~~Chat didn't open at the newest message~~ — fixed Phase 5 | ✅ |
| M13 | ~~Crisis banner / error toast pushed off-screen on phones~~ — fixed Phase 5 | ✅ |
| M14 | ~~Android manifest had no `RECORD_AUDIO` → microphone (dictation, voice notes) could never work in the app~~ — added 7.4 (+ CI check) | ✅ |
| M15 | ~~Header stuck on "TYPING…" after a reply; credits pill said "16 Premium" on Free~~ — fixed 7.1 | ✅ |
| M10 | Native builds hard-code Render URL | ⚪ |

### F. Performance
| ID | Issue | Sev |
|---|---|---|
| P1 | 56 `backdrop-blur`, 101 `motion.*`, 19 infinite animations | 🟠 |
| P2 | Each streamed token re-renders all bubbles; `MessageBubble` not memoized | ✅ Phase 4 |
| P3 | Lite mode (`isLowPowerMode`) is manual only — no auto-detection | ✅ Phase 4 |
| P4 | MoodTracker chunk 372 KB (recharts) | 🟡 |
| P5 | `ChatView.tsx` — stream transport/SSE parsing/batching moved to `hooks/useStreamingChat.ts` + `utils/sseParser.ts` (7.2); event handling still in ChatView | 🟡 |
| P6 | Noise overlay hot-linked from `grainy-gradients.vercel.app` | ✅ Phase 4 |

### G. Code quality & repo hygiene
| ID | Issue | Sev |
|---|---|---|
| Q1 | Tests: server 9 integration suites (`server npm test`), client Vitest (`client npm test`), CI on every push (`.github/workflows/ci.yml`); still no ESLint | 🟡 |
| Q2 | Pervasive `as any` | 🟡 |
| Q3 | Giant controllers (`authController` ~1060 lines, `chatController` ~690) | 🟡 |
| Q4 | Dead code: `VibeCheck`, `TheShift`, `BentoGrid`, `FloatingOS`, `FooterDoorway`, `routes/userRoutes.ts`, duplicate `layout/AppContainer.tsx` vs `components/layout/AppContainer.tsx`, `types/index.ts` vs `types/types.ts` | ⚪ |
| Q5 | Junk: 3× `New Text Document.txt`, empty `git`, empty `mobile_diary_*.png`, `client_log.txt`, APKs committed, loose images at root | ⚪ |
| Q6 | README stack/setup wrong | ⚪ |
| Q7 | Brain server loads 3 TTS models at boot | 🟡 |
| Q8 | Working folder `Aastha_Final-main (13)` is **not a git repo** (zip download). Owner decision: backup zip + one commit after all phases | 🟡 |
| Q9 | ~~Client pins TypeScript `~5.3.3`~~ — bumped to 5.9.3 in Phase 0 | ✅ |
| Q10 | ~~21 client type errors~~ — fixed 7.2: root cause was **no `@types/react`** (React 19 ships no types, so every hook/component was untyped); added `@types/react(-dom)`, typed the API `User` fields. Client `tsc` = 0, enforced in CI | ✅ |

---

## 2. Phase-wise plan

Order agreed: **P-1 cleanup → P0 → P1 …** Two 30-minute hotfixes ride along with P-1 because they are live exploits.

### Phase −1 — Repo cleanup & baseline (1–2 days) — ✅ done 2026-11-19 except owner items
- [~] Version control (Q8) — **owner decision:** no git during the phases; backup zip kept; single GitHub commit after all phases are tested
- [ ] **Hotfix:** rotate all Groq keys in the Groq console (owner action) (S3)
- [x] **Hotfix:** removed `/upgrade` route + `upgradeToPro` (S1) — client never called it
- [x] Removed `define` in `client/vite.config.ts` that injected `GEMINI_API_KEY` into the client (S19). Verified: no client code read it, and neither APK contains key-like strings
- [x] Deleted junk + verified-unreferenced code (Q4, Q5): `VibeCheck`, `TheShift`, `BentoGrid`, `FloatingOS`, `FooterDoorway`, `Layout`, root `components/Hero`, `GlassCard`, `src/layout/AppContainer`, `types/types.ts`, `tests/test_placeholder.ts`, `server/src/routes/userRoutes.ts`, 3× `New Text Document.txt`, `git`, `client_log.txt`, 2 empty PNGs. Moved `image.png` → `docs/assets/logo.png`, WhatsApp screenshot → `docs/assets/`
- [x] `.gitignore`: `*.apk`, `*.aab`, Python caches/models, `!*.env.example` (old `*.env.*` rule would have hidden the examples) (M1). APK files still on disk but won't be committed
- [ ] Root `package.json`/lock (R13) — **kept for now**: owner must confirm Render's root dir/build command before deleting
- [x] Added `server/.env.example`, `client/.env.example`
- [x] Added `.prettierrc.json`, `.editorconfig`
- [ ] ESLint config — deferred to Quality track (needs new devDeps; will flag hundreds of `as any`)
- [ ] Client `tsc --noEmit` fails only inside `node_modules/@vitejs/plugin-react` types (client pins TypeScript `~5.3.3`, too old) — bump TS in P0
- [x] Baseline verified: server `tsc --noEmit` ✅, server `npm run build` ✅, client `npm run build` ✅ (2026-11-19)
- [x] Rewrote README (real stack, setup, env, honest privacy note, crisis lines) (Q6, partly S8)
- **Exit:** clean tree ✅, both projects build ✅. Remaining: owner key rotation + Render check.

### Phase 0 — Stop the bleeding (1–3 days) — ✅ code done 2026-11-19 (needs live payment test + owner env setup)
- [x] Payments (S2, S18): `PLANS` catalogue in `paymentController.ts`; plan/amount/owner read from the Razorpay **order** (`orders.fetch`), payment checked via `payments.fetch` (must match order, `captured`/`authorized`), timing-safe signature compare, payment/order redeemable once across all users (+ indexes on `paymentHistory.paymentId/orderId`), correct amounts. Client no longer sends `planType`.
- [x] Pro expiry (R9): `authMiddleware` now uses `subscriptionExpiresAt` (stacked renewals no longer cut short); legacy fallback = `subscriptionDate + 30d`
- [x] Voice Pass (S16, S17): 1 day, stacks; `chatController` treats active pass as unlimited voice; Settings card says "₹19 / day" and shows "Active until …"; API responses now include `voicePassExpiresAt`, `subscriptionExpiresAt`
- [x] Client Groq removed (S3): deleted `client/src/services/groqService.ts` (it was unused), uninstalled `groq-sdk` and the server-only `razorpay` SDK from client. Built bundle scanned: no Groq references.
- [x] Brain server secret (S4): `x-brain-secret` header checked with `hmac.compare_digest`; enforced once `BRAIN_SHARED_SECRET` is set on HF Space **and** Render; errors no longer leak details
- [x] Crash safety (R1, R2): `unhandledRejection` logged (no crash), `uncaughtException` → graceful shutdown, SIGTERM graceful shutdown, Mongo connect retries with backoff (no `process.exit`), connection event logging, `/health` reports `db` state
- [x] Generic 500 error body (part of S12)
- [x] Client TypeScript → 5.9.3 (Q9); added `src/vite-env.d.ts`; removed duplicate `dragMomentum` prop. Uncovered 21 pre-existing type errors → Q10
- **Exit:** no free Pro ✅, no keys in bundle ✅, crash emails — verify after deploy.
- **Owner to-do before/after deploy:** set `BRAIN_SHARED_SECRET` (same value) in Render + HF Space secrets, redeploy the Space; do one real ₹19 and one ₹49 test payment.

### Phase 1 — Speed & stability (week 1–2) — ✅ code done 2026-11-19 (R3 awaits owner)
- [x] `Message` collection (`models/Message.ts`, index `user+timestamp`) + `services/messageStore.ts`. Legacy `Chat` docs migrate **lazily** on first access (atomic claim via `migratedAt`, legacy doc kept as backup, ids preserved). Optional bulk run: `npm run migrate:chats`. All consumers switched (chat, history, ai analyze/vibe, detective scan, data donation now streams, account delete) (R4)
- [x] `GET /api/chat/history?limit=50&before=<ISO>` decrypts only the page; `X-Has-More` header (exposed via CORS); messages now carry `id` (R5)
- [x] Client cache-first chat (`client/src/services/chatCache.ts`): last 50 messages render instantly, server refresh merges in background, first-ever load shows "Waking Aastha up…" after 4 s; cache cleared on logout (M2)
- [x] Login: key-rotation check fixed via `needsReencryption()` (was re-encrypting + saving on every login) (R6). Native `bcrypt` swap skipped — bcryptjs cost isn't the bottleneck vs cold start
- [x] `protect` writes at most once per IST day (+ on expiry) (R7)
- [x] One IST-midnight reset `utils/dailyReset.ts` used by `protect`, login, `getMe`; `usageMiddleware` no longer re-fetches/resets; new field `dailyResetAt` (R8). Expiry field unified in Phase 0 (R9)
- [ ] Render paid instance or uptime ping + Render Cron for ghost job (R3) — **owner decision**
- [x] OTP: max 5 wrong tries per code (verify, reset-verify, and security answer) → 429 until a new code; counter resets on new code (S5)
- [x] Token revocation: JWT carries `tv`; `protect` + WebSocket reject stale versions; password reset bumps `tokenVersion` (logs out all devices). Legacy tokens = v0 so nobody is logged out by the deploy (S6)
- [x] **New critical fix (S20):** reset-verified token (issued after OTP, before security answer) was accepted by `protect` as a full login → now any token with `purpose` is rejected (HTTP + WS)
- [x] Chat 500 no longer leaks `error.message`; `verifyOTP`/`resendOTP` email lookup is exact-match instead of regex (S12)
- **Verified:** in-memory MongoDB 7 integration checks — 21/21 store/migration/pagination/IST-reset/key-rotation, 7/7 auth (purpose token, revocation, legacy tokens, OTP lockout). Server tsc ✅, both builds ✅.
- **Known edge:** a second request arriving *during* a user's first migration may see partial history once (harmless, self-heals).
- **Exit:** chat visible < 1 s with cache ✅ (needs on-device check); login speed now dominated by Render cold start → R3.

### Phase 2 — AI brain rebuild (week 2–4) — ✅ code done 2026-11-19 (needs live check with real keys)
- [x] New provider layer `services/llm.ts` (A1, A3): ordered model chains per task (chat / vision / brain, env-overridable `AI_*_MODELS`), per key+model cooldowns honouring `Retry-After` / Groq `x-ratelimit-reset-*`, dead-model detection (404/decommissioned → skipped 1 h), max 4 attempts, last slot reserved for Gemini. No 8B models in the reply chain. SDK auto-retries disabled (were multiplying calls).
- [x] Discovered: `streamGroq` ignored its model arg — every reply ran on `qwen3-32b`; the "70B/8B voice" tiers were labels only. Now one chain for everyone (labels kept only as `meta` for the client).
- [x] No restart after partial output (A7); qwen3 `reasoning_format: hidden`, gpt-oss `include_reasoning: false`, and a chunk-safe `<think>` stripper (A8)
- [x] Images now reach a vision model (were flattened to text and never seen) (A14); Gemini fallback sends the real conversation (was sending "Continue")
- [x] `[STYLE:]`/`[TTS:]` stripped server-side *during* streaming (`utils/streamTags.ts`) and captured for TTS — the client was showing the native-script `[TTS: …]` copy to users (V7)
- [x] Brain call skipped for questions, greetings, forced replies and voice mode (A2); brain prompt rewritten, runs on `gpt-oss-20b` → 70B, tolerant JSON parsing
- [x] Prompts → `prompts/companion.ts` character sheets: shared core (introvert-friendly, no forced questions, memory honesty, helplines, tools) + short Aastha/Aastik voices; random per-message "tone flavor" removed (A15); time/age as soft context; pet names off by default (A5). `chatController` 690 → ~440 lines
- [x] Memory v2 `services/memoryService.ts` (A4): facts were never being saved — now user-stated facts only, encrypted, de-duped, outdated ones removed, cap 40; conservative summary; runs every 6 messages on the latest turns incl. the current reply
- [x] Gender inference removed from prompts, brain context and ghost emails (S14)
- [x] Ghost (A10): no `mad` mood; email rewritten from "needy / dramatic / aliens kidnapped you" to a gentle no-pressure check-in; login sets mood `neutral` (was forced `happy`)
- [x] Whisper no longer forced to English (Hindi/regional speech was mangled) (V8); unique temp files
- [x] Fixed Phase 1 race: concurrent first requests now share one migration (loser used to read an empty history)
- **Verified:** 23/23 fake-provider checks (cooldowns, Retry-After parsing, dead models, partial-stream, Gemini fallback, outage error, vision routing, think/tag stripping, brain skip, memory merge, prompt rendering) + Phase 1 suites 21/21 & 7/7 re-run ×3. Server tsc ✅, builds ✅.
- **Not yet:** real-key smoke test (model names in the default chains must still exist on Groq — dead ones are auto-skipped, but check logs for `[LLM] … model_gone`). Other Gemini-only helpers (diary/chat analysis, vibe playlist, clone) still call Gemini directly → move to `llm.ts` in Phase 6.

### Phase 3 — Personality & voice — ✅ code done 2026-11-19 (needs live check + HF Space redeploy)
- [x] **Critical (S21):** crisis messages were answered with plain JSON on an SSE stream, so the app **silently dropped the helpline message**. Now: `utils/safety.ts` runs on every message before any LLM → `{type:'safety'}` event + warm model reply with a safety section placed LAST in the prompt; if every AI provider is down, a fixed caring message with helplines is streamed instead. App shows a support banner with tap-to-call numbers.
- [x] Crisis detection v2 (S9): crisis / concern / none; EN + Hinglish + Devanagari phrases (kms, better off without me, marna chahti, आत्महत्या…); false positives excluded ("dying to see", "killed it", "dead tired"). Crisis forces a reply (no silent listening mode), no voice note, no thinking mode.
- [x] Helplines: **Tele-MANAS 14416** now primary (+ iCall, 112). KIRAN removed pending owner verification (reported merged into Tele-MANAS).
- [x] Style mirroring (A6): `services/relationship.ts` fingerprints each message (length, emoji, lowercase, Hinglish, shorthand, swearing, "!") → smoothed profile on `user.styleProfile` → one "Their texting style…" prompt line after 3 messages.
- [x] Bond levels (A6): New friend → Getting to know you → Friend → Close friend → Bestie (0/25/100/300/700 pts; 0/15/60/160/350 since 2026-11-24). Points: +4 new IST day, +1/msg (cap 30/day), +2 long shares; fades after 14 idle days (never below previous level). Tone card per level; one-time level-up acknowledgement + 💞 toast. User override in Settings.
- [x] Language & region (A9): `preferredLanguage` (auto + 13 Indian languages) and optional `region`; prompt follows them, regional slang only after the user uses it.
- [x] Thinking mode: `think` model chain (qwen3-32b → gpt-oss-120b) with reasoning returned **separately** (Groq `reasoning_format: parsed`); auto for decisions/dilemmas for everyone, "Think deeper" toggle for Pro; app shows a collapsible "💭 Thought it through" section above the reply. (Deviation from plan: raw reasoning is shown collapsed rather than an extra summarisation call — saves a call per message.)
- [x] Voice (V1, V2, V4, V6): `brain_server/engines/routing.py` — ONE voice per persona; Latin → Kokoro `en-us`, Devanagari → same voice with `hi`, other Indic scripts → Indic Parler; `[STYLE]` no longer switches engines (only speed); unique temp files for cloning; sentence-aware trimming (incl. Hindi danda).
- [x] Removed duplicate tool proposals (server prompt re-requested brain tool calls the app already renders) (A16).
- [x] App: "Connection & Persona" settings tab with **Your connection** card (closeness, language, region, Think deeper); safety banner; bond toast; reasoning UI in bubbles.
- [x] Tests now live in the repo: `cd server && npm test` (4 suites: storage/migration, auth, AI layer, Phase 3 incl. end-to-end chat controller with fake providers) + `python brain_server/tests/test_routing.py`. Uses `mongodb-memory-server-core` (no download at install).
- **Verified:** 30/30 Phase 3 checks (incl. E2E crisis with total AI outage) + all earlier suites; routing 9/9; server tsc ✅; both builds ✅; client still exactly 21 pre-existing type errors (Q10).
- **Not yet:** redeploy the HF Space (routing.py + tts changes) and listen to Hindi/Hinglish notes; Kokoro `hi` quality on Marathi Devanagari is unverified; live check of Groq `reasoning_format: parsed` deltas on the current model list.

### Phase 4 — Mobile & notifications — ✅ code done 2026-11-19 (needs on-device check)
- [x] One notifications module `client/src/services/notifications.ts`: fixed ID ranges per feature, each feature cancels only its own IDs (M3). Ghost check-ins no longer wipe daily reminders / Pomodoro, and vice versa.
- [x] **Pomodoro alert never arrived on locked phones** (it was sent from JS when the countdown hit 0, but JS pauses in the background) → now pre-scheduled with Android for `targetEndTime`, cancelled on pause/reset.
- [x] `notificationService.init()` was never called → daily reminders now restored on every launch; Settings toggle loads its real state (always showed "off").
- [x] Android: `SCHEDULE_EXACT_ALARM` + `RECEIVE_BOOT_COMPLETED` (M5); Settings asks the user to allow "Alarms & reminders" when turning notifications on; real white status-bar icon `res/drawable/ic_stat_aastha.xml` + `capacitor.config.ts` default (M9); proper channels (check-ins vs focus timer).
- [x] Gentle, gender-neutral check-in copy (no "bro/king/queen", no guilt).
- [~] Server push (M4): **no Firebase** → native-app push deferred. Instead **Web Push (VAPID, no Firebase)** for website/PWA users: `server/src/services/webPush.ts`, `/api/users/push/{key,subscribe,unsubscribe,test}`, `public/push-sw.js` imported into the Workbox SW, Settings toggle subscribes on web (iPhone: after Add to Home Screen). Ghost service now sends push first, email too if configured, and no longer exits when Resend isn't configured.
- [x] CI (M1): `npm ci`, `cap sync`, manifest script, then **fails the build if any native plugin is missing**, the web build isn't copied, or the exact-alarm permission is absent; APK artifact named per run. Verified locally: all 6 plugins register after `cap sync`.
- [x] Chat performance (P2): `MessageBubble` memoized (only the streaming bubble re-renders); stream state batched to ≤ every 50 ms.
- [x] Auto lite mode (P3): also on for ≤4 GB RAM / ≤4 cores / Data Saver / reduce-motion; global `html.lite` CSS kills **all** backdrop blurs, looping animations and full-screen grain overlays; framer-motion `MotionConfig reducedMotion`.
- [x] Bubble overflow on narrow phones fixed (`85vw` → % of row) (M6); darker wallpaper overlay (M8).
- [x] **Found live breakage:** the grain texture hot-linked from `grainy-gradients.vercel.app` now returns **402** on every page load → self-hosted `public/noise.svg` (P6).
- **Verified:** browser preview at 375 px (lite on, no horizontal overflow, blurs off, no external texture requests) and desktop (lite off, texture 200); server `npm test` 5/5 suites incl. new Web Push suite (validation, dedupe, 5-device cap, 410 cleanup); `cap sync` plugin check; builds ✅; client still 21 pre-existing type errors.
- **Caught & fixed during verification:** my first lite-mode CSS darkened glass elements on the light landing page — removed.
- **Not yet:** on-device test of notifications/exact alarms; Web Push needs VAPID keys on Render; native push needs a Firebase project later.

### Phase 5 — Design system: Material You × Liquid Glass — ✅ done 2026-11-19 (verified in browser with the dev sandbox)
- [x] **Material You tokens** `client/src/design/materialTheme.ts`: Google's `@material/material-color-utilities` (TonalSpot, same as Android Monet) turns ONE seed into 24 roles → CSS vars `--md-*` (R G B) → Tailwind `md-*` colours (`bg-md-surface-container-high`, `text-md-on-primary-container`, …). Seed = existing theme system (wallpaper extraction → AI `<color>` → preset). New default theme **Lotus** (#8B7CF6, logo lavender). Contrast checked: 10 seeds × 7 text/surface pairs, worst 7.18:1 (WCAG AAA-level).
- [x] **Liquid Glass** utilities in `index.css`: `.glass` (translucent tonal + 18px blur + saturate + specular edges), `.glass-pill`, `.glass-specular` (touch-following highlight via `useSpecular()`), `.glass-refract` (SVG displacement — Chromium/Android only, `design/LiquidGlass.tsx`). Lite mode / `prefers-reduced-transparency` → opaque tonal surface.
- [x] Rule applied: glass only on controls — phone header bar, composer pill, bottom tab pill, scroll-to-latest FAB. Content (bubbles, chips, date separators, sheets) uses tonal Material surfaces with no blur.
- [x] Chat: tonal bubbles (user = primary-container, Aastha = surface-container-high + thin mood accent), Material send button, `**bold**`/`*italic*` rendering (was showing raw asterisks), M3 chips for tool proposals.
- [x] **Phone shell**: `components/layout/MobileTabBar.tsx` — floating glass pill (Chat · Diary · Mood · Relax · Me), M3 indicator pill, shrinks while scrolling down chat and expands on scroll up/tap; widgets open as rounded Material sheets (28px top radius, handle) with room for the tab bar.
- [x] `ChatView` split started: `ThoughtCloudModal.tsx`, `SafetyBanner.tsx` extracted (1,702 → 1,632 lines). Streaming/send logic intentionally left until there are client tests (Quality track).
- [x] **Dev sandbox** `server/dev/sandbox.ts` (`npm run dev:sandbox`): real API + in-memory MongoDB + seeded demo user + fake AI when no keys. Refuses to run in production.
- **Bugs found & fixed while verifying in the browser:**
  - API crashed at startup when `RAZORPAY_KEY_ID` was missing (Razorpay client created at import) → lazy client, payments return 503 instead (R14).
  - Chat history reads shared the 20/min *send* limiter; on web every focus change refetched history → **users' messages could get 429** → only POST counts against the chat limit, resume-sync throttled to 30 s (R15).
  - "Connecting…" spinner stuck forever under React StrictMode (dev) — per-effect mounted flag + init guard (M11).
  - Chat didn't land on the newest message on open (smooth scroll fired before bubbles finished animating) → stick-to-bottom with ResizeObserver/MutationObserver (M12).
  - Crisis banner and error toast rendered off-screen on phones (framer-motion `y` overwrote the `-translate-x-1/2` centring) (M13).
  - My first header style collapsed the header to a tiny pill (missing stretch) — fixed before shipping.
- **Not done (by design):** Android system-accent (Monet) bridge needs a small native Capacitor plugin → Phase 6 / later; Aastha-mood tinting of the palette skipped (distracting); landing page & settings still use the old styling (they read fine; migrate gradually to `md-*` tokens).

### Phase 6 — Trust & features — ✅ done 2026-11-20 (cookie-only auth deferred)
- [x] **False public privacy claims removed (S8):** landing FAQ said "Zero-Knowledge Encryption… encrypted on your device… we have no way to read your conversations", a feature card said "End-to-End Encrypted", SEO keywords claimed "Zero Knowledge Encryption / No Logs Policy / Anonymous AI", and the voice card said "hands-free therapy". Rewritten to accurate copy ("Private by Design", honest FAQ).
- [x] **In-app Privacy Center** (`client/src/components/settings/PrivacyCenter.tsx`, Settings → Data & Privacy): what's encrypted, why it's not end-to-end, which processors see data (Groq, Gemini, voice server, Razorpay, Resend), on-device cache, The Web, donation (off by default, unlinked, ≤1 year), safety checks, deletion scope. Every line matches the code.
- [x] **The Web encrypted (S7):** name, alias, notes and photos of third parties now AES-256 at rest; lookups via `blindIndex()` (HMAC) instead of an unescaped regex (also fixes regex injection); legacy plaintext rows migrate on first read (duplicates merged); mugshot upload validated (type + ~1.8 MB) and ownership-checked; scan uses `llm.ts`.
- [x] Diary mood keywords encrypted; ghost service decrypts (S13).
- [x] **Voice notes**: linked to their owner, deleted with the account (they previously survived deletion), unguessable `randomUUID` ids (S11 partly — still link-accessible, but no longer guessable; 30-day expiry).
- [x] **YouTube (A11):** `services/youtubeSearch.ts` — 30-day MongoDB cache + hot cache, concurrent-request merging, quota circuit-breaker until midnight Pacific, playlists capped at 10 songs.
- [x] Remaining Gemini helpers moved to `llm.ts` (failover/cooldowns); dead code removed (`streamGemini`, `mergeLoreDescription`, `analyzeSentiment`, `extractColorsFromImage`, `getAgePersonaPrompt`).
- [x] **Wallpaper → theme never worked** (server always returned the same violet) → now on-device Material `sourceColorFromImage` (real Material You behaviour, no AI cost).
- [x] **Clone Mode v1 with consent (A12, A13)** — owner chose "build with consent" (2026-11-20):
  - Consent first, enforced server-side (`services/cloneService.ts`, `controllers/cloneController.ts`): "my own style" or "someone else"; someone else requires a name + confirming they agreed, are 18+, and that it won't be used to deceive anyone or impersonate them outside the app; everyone acknowledges replies are AI imitations. Versioned (`CLONE_CONSENT_VERSION`), timestamped, name encrypted. Changing the person wipes the learned style/voice.
  - Screenshot → **structured style notes (data, never a model-written prompt)**, so text inside a screenshot can't inject instructions; fields length-capped; screenshot discarded; notes encrypted and shown to the user.
  - Voice sample (optional): validated audio type/size, encrypted at rest, `select:false`; used for F5 cloned voice notes when the user enables it.
  - Chat: clone prompt with honesty rules (admits being an AI imitation when sincerely asked, no invented private facts, kind, steps out if distressed); clone sees only its own past replies; **crisis messages always bypass the clone** → Aastha + helplines; 30 replies/day (IST reset) then falls back to Aastha; clone replies saved with `isClone`, never donated as training data, never fed to memory.
  - App: `CloneSettings.tsx` (consent → style → voice → on/off → delete), chat banner "Chatting with an AI imitation of {name} · Turn off", every clone reply labelled "🎭 AI imitation · {name}" (kept in history after turning off), toasts when paused for safety / daily limit. Old "Under development" placeholder and dead upload stub removed.
  - Verified: `clone` suite 26/26 + full `npm test` 7/7; browser walkthrough in sandbox (consent button disabled until all 4 statements ticked, style learned, banner, labelled reply, Turn off).
- [ ] **Cookie-only auth (S10): deferred** — the Android app calls the API cross-site from `http://localhost`; Android WebView blocks third-party cookies by default, so cookie-only would log every app user out. Needs either a same-site API domain (e.g. api.aasthaai.site + Capacitor server config) or CapacitorHttp cookies. Mitigations in place: token revocation (Phase 1), no secrets in the bundle.
- **Verified:** new `phase6` suite 19/19 (no plaintext in DB, blind-index dedupe, legacy migration, regex-proof lookups, mugshot ownership, diary keyword encryption, voice-note deletion, YouTube cache/merge/quota breaker/reset time); full `npm test` 6/6; builds ✅; browser: landing page has none of the old claims; Privacy Center renders.

### Owner extras (2026-11-20) — ✅ done
- [x] **Diary forgot-password rework (S22, S24):** entries are KEPT (the diary password is only a lock; the key comes from the account password). Verify with account password, security answer, or a 6-digit email code (10 min); shared lockout 5 tries → 15 min; "start fresh" wipe is a separate, verified, confirmed action. Old recovery never worked (it called the account-reset endpoint, so the question was always blank). UI: `DiaryPasswordReset.tsx` in Settings → Security and behind "Forgot password?" on the diary lock screen. OTPs no longer logged in production (S23).
- [x] **Proper formatting:** `client/src/utils/miniMarkdown.tsx` renders bold/italic/strike/code/https links/headings/lists/quotes safely (no HTML injection, no regex lookbehind for iOS < 16.4, half-typed markers hidden while streaming). No more raw `**`.
- [x] **All languages (A9+):** `server/src/utils/languageDetect.ts` detects 10 Indic/Arabic scripts and 9 romanised Indian languages (Hinglish, Tanglish, Banglish, Manglish, Telugu, Kannada, Marathi, Gujarati, Punjabi in English letters); the style profile tracks the dominant language and follows a switch; prompt tells the model to reply in the same language AND script. Language picker: 42 options (Indian + world). Voice: Kokoro/Parler routing unchanged — non-Hindi Indic voice quality still needs a live listen.
- [x] **GIF / meme reactions:** model may end a light reply with `[GIF: phrase]`; tag stripped mid-stream; server resolves it via GIPHY (`rating=pg`) or Tenor (`contentfilter=high`); https only; only the short phrase leaves the server. Never in crisis/concern, clone, voice calls or sad moods; user toggle in Settings; saved with the message. **Off until `GIPHY_API_KEY` or `TENOR_API_KEY` is set.**
- [x] **Clone from an exported chat:** WhatsApp `.txt` (Android/iOS formats) or Telegram `result.json`, parsed ON THE DEVICE (`client/src/utils/chatExport.ts`); user picks the person; only that person's messages (≤400, scrubbed of numbers/emails/links/@handles/other names) are uploaded; server scrubs again, measures length/emoji/caps deterministically, asks the AI for notes, stores only encrypted style notes. Needs ≥15 messages.
- **Verified:** new `extras` suite 33/33 (language detection 17/17, style switch, diary reset + lockout + start fresh, chat-sample consent/scrub/encryption, GIF tag/stream/history/crisis/toggle); full `npm test` 8/8 suites (170 checks); browser (sandbox): markdown reply, GIF in bubble, diary reset keeps entries, 42-language picker + GIF toggle saved, WhatsApp export parsed → person auto-picked → style learned.

- [x] **WhatsApp-style voice notes:** new `VoiceNotePlayer.tsx` — real waveform (decoded once, cached; stable pseudo-waveform in lite mode), tap/drag the waveform to seek with a scrub dot, 1×/1.5×/2× speed, keyboard ←/→, only one note plays at a time; plain `<audio>` playback so it also works in lite mode/native app. Server `GET /api/ai/stream/:id` now answers HTTP Range requests (206) — before, browsers couldn't seek at all. `wavesurfer.js` removed (smaller bundle). Old lite mode had no waveform and no seeking.
- [x] **Widgets no longer springy:** `DraggableWindow.tsx` animated the drag offset back to 0 with a spring after every release (bounce) and the clamp snapped afterwards. Now the offset is a motion value zeroed in the same frame top/left are committed, edges are hard constraints during the drag (`dragElastic=0`), open/minimise use a short Material ease instead of a spring, and the phone's minimised bubble stays where it's dropped (a drag no longer counts as a tap). Browser frame log: window stops exactly where released, no extra movement.

### Phase 7 — Polish, launch readiness & "feels like a friend" (planned 2026-11-20)
Order matters: fix what users see first, then prove it on real devices, then add features on a safe base.

**7.0 Done already**
- [x] Auto-read responses OFF by default. Voice calls used to save "auto-read on" permanently (stuck on if the app closed mid-call); calls now speak without touching the setting, the setting moved to a new key so everyone starts OFF once, and the Settings toggle updates the chat screen immediately.

**7.1 Visible bugs — ✅ done 2026-11-22**
- [x] Header stuck on "TYPING…": the stream now has one guaranteed `onSettled` (done / error / stop) that resets the status (`hooks/useStreamingChat.ts`); a superseded stream no longer resets the new one. Browser-checked.
- [x] Voice notes (Aastha's and yours) show the player with **Show text / Hide text** underneath (`MessageBubble.tsx`).
- [x] Credits pill: `utils/plan.ts` → "N messages left today" / "Eco mode · resets at midnight" / "Pro" / "Voice Pass until 9 pm" (compact "N left" below 1280 px so it never overlaps the status). Server count was also off by one (R17) — fixed + tested.
- [x] **Diary sync retry storm (R16):** `services/offlineQueue.ts` — one queued version per diary day (legacy queues de-duplicated), only network/5xx/429 are queued (other 4xx dropped), single-flight, persisted backoff 30 s → 30 min with Retry-After, stops at the first failure, sync on start / resume / `online`. Also fixed: the `online` listener was never removed. A Vitest case caught a lock bug in my first version (an early-return sync left the lock set forever) — fixed before shipping.
- Verified: `phase7` server suite (credits) + client Vitest (`offlineQueue`, `plan`, `sseParser`) + sandbox browser check.

**7.2 Safety net — ✅ done 2026-11-22**
- [x] `.github/workflows/ci.yml`: server `tsc` + 9 integration suites + build; client `tsc` + Vitest + build + "no API keys in bundle" scan, on every push/PR. APK workflow now also checks the Filesystem/Share plugins and `RECORD_AUDIO`.
- [x] Sentry on server (`src/monitoring.ts`, `@sentry/node`) and client (`src/monitoring.ts`, `@sentry/react`, lazy-loaded): **off unless `SENTRY_DSN` / `VITE_SENTRY_DSN` are set**; errors only (no tracing/replay), `sendDefaultPii: false`, every event through `utils/scrub.ts` (drops request bodies, cookies, auth headers, query strings, console breadcrumbs, frame vars; masks emails/phones/JWTs/long secrets). Scrubber tested on both sides.
- [x] Vitest (`client/vitest.config.ts`, `npm test`): 37 tests — `miniMarkdown` (incl. "no regex lookbehind"), `chatExport`, voice-note seek maths (`utils/voiceNoteMath.ts`), SSE parser, offline queue, plan label, export builder, scrubber.
- [x] `useStreamingChat` + `sseParser` extracted from ChatView (fetch, SSE parsing across chunk boundaries, ≤50 ms batching, abort, settle). ChatView keeps only "what each event means".
- [x] Q10: client `tsc --noEmit` = **0** (was 21). See Q10.

**7.3 Real-device + live pass — script ready: [TEST_SCRIPT.md](TEST_SCRIPT.md) (50 steps). Owner runs it once; I fix what fails.** Owner decision 2026-11-22: do NOT pause here. Build 7.1 → 7.2 → 7.4 → 7.5 in one go; write the test script (covering everything in Phase 7 too) as the last step; owner tests it all in one shot at the end. Checklist — the HANDOFF checklist: ₹19 / ₹49 payments, notifications on a locked Android phone, Hindi/Tamil/Bengali voice notes after the HF Space redeploy, crisis banner, Clone Mode with a real WhatsApp export, GIFs with a real key, widget drag on a phone. I prepare a one-page test script; owner runs it on device; I fix what fails.

**7.4 "Feels like a friend" — ✅ code done 2026-11-22 (needs phone test)**
- [x] **Aastha reaches out first** (`services/reachOut.ts`): memory v2 now also extracts dated follow-ups (user-stated, future, ≤60 days, ≤10 pending, encrypted). On the day (±3 days) the prompt gets one "ask how it went — once, lightly" line and the item is marked *asked*. Otherwise the day after: **web push** via the ghost cron (every 15 min) or, in the phone app, **local notifications** scheduled from `GET /users/reach-out` (`services/followUpCheckIns.ts`, own ID range 2001–2005). Caps enforced server-side, **on the user's own clock** (device time zone stored as `user.timeZone`, DST-safe via `utils/timeZone.ts`, India until known — owner request 2026-11-22): 1 per local day, only 10:00–21:00 local, none within 48 h of a crisis message (crisis also cancels scheduled ones on the phone), not while the user is active, off switch in Settings → Connection. Fixed gentle template (no LLM, no guilt).
- [x] **Mood over time** (`services/moodInsights.ts`, `GET /data/moods/insights`): 7-day strip + at most ONE insight — journaling vs non-journaling days (≥3 days each, ≥1 point gap) or this week vs last; otherwise an honest "not enough data / steady" line; always "not a diagnosis". Shown at the top of Mood → Trends.
- [x] **Your voice notes as bubbles**: tap-to-record (`hooks/useVoiceRecorder.ts`, ≤2 min, webm/mp4), server validates type/size, stores the recording **encrypted** (`VoiceNote.encrypted`, same 30-day TTL, owner-linked → deleted with account), Whisper gets the right file extension, `transcript` event replaces the placeholder; bubble = waveform player + Show text. **Found:** Android manifest had no `RECORD_AUDIO` (M14) — added.
- [x] **Reactions** (`services/reactions.ts`, `POST /chat/react`): ❤️ 😂 👍 on Aastha's replies only (own messages only, validated), shown as a badge, kept in history/cache/export; last 3 within 30 days become one "what has landed lately" prompt line (never mentioned unless the user does). New `saved` SSE event gives the client real message ids.
- Verified: `phase7` suite 47/47 (rules, caps, crisis cooldown, quiet hours, sweep sends once, encryption at rest, Range playback, reaction ownership, prompt lines) + browser (reaction POST 200 + badge persists, voice bubble + Show text, mood strip, check-ins toggle).

**7.5 Trust — ✅ done 2026-11-22 except cookie auth (blocked on owner DNS)**
- [x] **Export my data** (`GET /users/export`, `controllers/meController.ts`; `ExportMyData.tsx`): one JSON with profile/plan/payments, settings, memory summary + facts + follow-ups, moods, diary (unlocked on the device with the diary key; otherwise marked `locked`), The Web, Clone Mode consent + style notes, every chat message (with reactions/voice links). No password hashes/tokens/push keys. 3 exports/hour. Web = download; phone = Filesystem + Share sheet (`@capacitor/filesystem`, `@capacitor/share` — new native plugins, CI-checked).
- [x] **"How Aastha keeps you safe"** card (`components/SafetyIntroCard.tsx`): shown once per account after the tour (`safetyIntroSeenAt` on the server + local flag), also in Settings → Data & Privacy. Privacy Center copy updated for check-ins, reactions and your recordings.
- [ ] Cookie-only auth via same-site API domain (`api.aasthaai.site`) — **still blocked on owner DNS** (S10). Nothing built yet on purpose: it needs the real domain to test the Android WebView cookie behaviour.

**Owner batch (2026-11-22/23) — ✅ done (needs phone test: TEST_SCRIPT §14)**
- [x] **Rolling 24 h quota** (owner choice): 16 messages / 2 voice notes / clone replies per 24 h from the first message; server clock only; app shows "Refills at 3:40 pm". Replaces IST-midnight reset (R8 semantics changed on purpose).
- [x] **Reactions on phone**: long-press → WhatsApp-style bar (❤️ 😂 😮 😢 🙏 👍 + "+" full emoji picker), double-tap = ❤️, tap the badge to change/remove; server accepts any single emoji.
- [x] **Design system everywhere**: M3 kit (`client/src/design/ui.tsx`), Settings (nav drawer / grouped list, glass top bar; fixed the off-centre "Connection & Persona"), floating glass desktop sidebar, glass widget title bars, Mood / The Web / Breathing / Music / Sounds / Focus reworked (same behaviour), Diary header + day bar, login / sign-up / OTP / forgot password, landing page, lock / loading / error screens.
- [x] **Fonts + icons**: Plus Jakarta Sans + Fraunces (self-hosted, no Google requests), Phosphor duotone icons in tonal tiles.
- [x] **The Web**: AI chooses who someone is (~20 roles + custom label) and how it feels (8 vibes); legend shows what's on your board; "Not right? Change" keeps your correction.
- [x] **Custom moods**: name + emoji + level 1–10 (encrypted names, up to 24, synced); used in the grid, charts and insights.
- [x] **Mac / Windows window buttons**: Settings → Appearance, saved on the account (same on phone and web).
- Fixed in passing: auto-lock "5 minutes" option was 30 s; untrue copy (diary password "cannot be recovered", "fine-tuned for EQ", "Available on iOS & Android", dead footer links).
- [x] **Privacy Policy + Terms** (`/privacy`, `/terms`), consent recorded at sign-up and re-accepted by existing users, 18+ enforced, payment records archived on deletion (2026-11-23).
- [x] All user-facing "days" on the user's local time (streak, closeness bonus, check-ins, mood days, memory "today"); landing light/dark toggle; Aastha-only branding; doorway scene (2026-11-23).
- [x] **Encryption audit + key rotation** — every free-text/PII field encrypted at rest (incl. profile, all voice notes, training data), no plaintext email, keyring with automatic re-encryption sweep, blind-index + JWT rotation (`docs/KEY_ROTATION.md`) (2026-11-23).
- [x] Colour wheel for the Sanctuary colour (synced across devices); clearer liquid glass on chat header / message bar / tab bar with content scrolling underneath; chat aura background + refreshed bubbles (2026-11-23).
- [x] Message actions on phones made reliable (long-press with any pointer, closes cleanly); font choice for the Sanctuary (10 text + 4 heading fonts, synced); Sanctuary colour no longer leaks onto landing/sign-in/legal (2026-11-23).
- [x] Mood widget no longer remounts ("auto refresh") or lags on Trends; adding a custom mood closes the sheet and shows it (2026-11-23).
- [x] **Same voice at every closeness level** (2026-11-24): tone cards no longer say "polite / light on emojis"; levels differ only in familiarity; thresholds 0/15/60/160/350 (Bestie ~3 weeks). (A6 follow-up)
- [x] **Raw `<proposal>` text in bubbles** fixed (two tags in one reply skipped by the old parser); copy/reply use clean text (2026-11-24).
- [x] **Reply lost when the app is closed** (2026-11-24): 6 s pause flushed on background + on-device outbox; dropped streams recovered from history (in-flight marker, 5 s polling up to 5 min).
- [x] **"Left on seen" with the app closed** (2026-11-24): deferred signed nudge → local notification after 20 min (not 22:00 to 09:00) → saved to chat only if it fired. Ghost notification copy in texting voice.
- [x] **Start fresh with Aastha** (2026-11-24, owner chose "let the user pick"): Settings → Connection card, checkboxes for closeness / memories / chat history; memories and chats need the account password (422 on a wrong one, shared lockout). `POST /users/fresh-start`.
- [x] **Indian, human voice notes via Sarvam Bulbul** (2026-11-24, V1/V2 follow-up): `services/sarvamTts.ts`, on when `SARVAM_API_KEY` is set, HF Space as fallback, cloned voices stay on F5. Privacy Policy + Privacy Center list Sarvam (privacy version bumped to 2026-11-24 → users re-accept once). **Owner:** create the key and add it on Render; voices picked by ear: **shreya** (Aastha), **rohan** (Aastik), the code defaults.
- [x] Jam fixes (songs-only search, real fallback, chips, skip unplayable), stop actions, Lite Plus, What Aastha remembers, weekly letter, hide notification text (2026-11-24)
- [x] **Time sense** (2026-11-24): gap since the last message in the prompt; long gaps = new moment, stale thread trimmed (`services/timeGap.ts`)
- [x] **Personal notifications** (2026-11-25): daily lines written by Aastha per user; check-in name bug fixed (ciphertext in text). The Web: lines follow dragged names; companion and user filtered out.
- [x] **Lock-screen + notification music controls (APK)** (2026-11-25): native media session plugin, one notification, seek bar, headset buttons.
- [x] Lock-screen Repeat button (plugin patch), Jam with Aastik, persona descriptions, closeness chips follow automatic level-ups (2026-11-25).
- **Owner:** fill `client/src/legal/legalInfo.ts` (operator, address, emails, grievance officer, court city) and get a lawyer to review `client/src/legal/content.tsx` before launch.

**Owner-side:** Render paid instance or uptime ping (R3), env vars (VAPID, BRAIN_SHARED_SECRET, GIPHY/Tenor), Sentry account → `SENTRY_DSN` (Render) + `VITE_SENTRY_DSN` (Vercel), DNS for the API subdomain, **rebuild the APK** (new mic permission + 2 plugins), then run [TEST_SCRIPT.md](TEST_SCRIPT.md).

### Ongoing — Quality
Tests for payments, auth, memory, bond engine; remove `as any`; split controllers; CI runs typecheck + tests (Q1–Q3).

---

## 3. Design direction — Material You × Liquid Glass

**Rule:** *Material You for content, Liquid Glass for controls.*
- Content layer (chat bubbles, diary, mood cards): opaque tonal M3 surfaces — warm, personal.
- Control layer (bottom tab pill, composer pill, top bar, FAB): translucent glass — max 3–4 glass elements on screen.

**Dynamic color:** `@material/material-color-utilities` → tonal palette from a seed → CSS variables (`--md-primary`, `--md-surface-container`, …) → Tailwind tokens.
Seed priority: user wallpaper (`sourceColorFromImage`) → Android 12+ system accent via small custom Capacitor plugin → logo lavender. Aastha's mood subtly tints the seed. The AI "change theme" tool sets the seed.

**Shape:** 12/16/28 px radii, pill buttons, suggested replies as M3 chips. Depth via tonal surfaces, not shadows/blur.

**Glass (web approximation):**
```css
.glass {
  background: color-mix(in oklab, var(--md-surface) 55%, transparent);
  backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgb(255 255 255 / .12);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .28), 0 8px 30px rgb(0 0 0 / .25);
  border-radius: 999px;
}
```
Refraction via SVG `feDisplacementMap` backdrop filter on Chromium/Android only; plain blur on iOS WKWebView. Tab bar shrinks to a pill on scroll (framer-motion `useScroll` + `layout`). Touch-following specular highlight. Glass tint flips light/dark by backdrop luminance.

**Motion:** one shared spring set; container transforms via `layoutId`; overscroll stretch; ripple; kill infinite animations except one presence glow.

**Platform lean:** Android → M3 (system color, ripples, M3 nav bar). iOS → glass tab pill, less tint. Desktop → side rail.

**Guardrails:** auto lite mode (no blur/refraction, glass → opaque tonal); honor reduced motion/transparency; WCAG AA check on generated palettes.

**Phone shell:** glass top bar (avatar + bond glow + mood dot) · edge-to-edge chat · glass composer pill · floating tab pill (Chat · Diary · Mood · Relax · Me) · widgets as full-screen M3 sheets morphing from cards.
