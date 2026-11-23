# Aastha — Emotional Wellness Companion

Aastha (and her counterpart **Aastik**) is an AI companion for students and young professionals: a warm, judgment-free space to vent, reflect, journal, track mood and unwind — on the web and on Android/iOS.

> ⚠️ **Not a medical device.** Aastha is a wellness tool, not a replacement for therapy or psychiatric care. If you are in crisis in India, call **Tele-MANAS 14416** (free, 24/7) or **iCall 9152987821**, or **112** in an emergency, or your local emergency number.

## Features
- **Chat** with streaming replies, emoji reactions, suggested replies and a "listening" mode for venting
- **Voice** — speak to Aastha (Whisper transcription) and receive voice notes (Kokoro / Indic Parler TTS)
- **Diary** with a separate password, encrypted at rest, offline-first sync and AI insights
- **Mood tracker** with charts
- **Relax tools** — soundscapes, guided breathing, Pomodoro focus timer, "Jam with Aastha" music
- **The Web** — a map of the people in your life, built from your conversations
- **Personas** — Aastha (female) / Aastik (male), age-aware tone
- **Plans** — Free tier, Pro (₹49 / month), Voice Pass (₹19 / day — being fixed, see ROADMAP S16/S17)

## Privacy (accurate as of today)
Chats, diary entries, moods and emails are **encrypted at rest** on the server (AES-256-GCM). The server holds the key so it can talk to the AI on your behalf — this is *not* end-to-end / zero-knowledge encryption. You can permanently delete your account and all data from Settings.

## Architecture
| Part | Stack | Hosting |
|---|---|---|
| `client/` | React 19, Vite 5, Tailwind 3, framer-motion, Capacitor 6 (Android/iOS) | Vercel (`aasthaai.site`) |
| `server/` | Node, Express 4, TypeScript, Mongoose 8 (MongoDB), WebSocket sync, Razorpay, Resend | Render |
| `brain_server/` | Python FastAPI — `/speak` (TTS), `/see` (image captioning) | Hugging Face Space |

AI providers: Groq (Llama / Qwen / GPT-OSS models) with Google Gemini as fallback.

## Local setup
Prerequisites: Node 20+, npm, a MongoDB connection string.

```sh
# 1. API
cd server
cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, SERVER_ENCRYPTION_KEY, AI keys
npm ci
npm run dev               # http://localhost:5000  (health: /health)

# 2. Web app (new terminal)
cd client
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm ci
npm run dev               # http://localhost:3000
```

### Android build
```sh
cd client
npm run cap-dist          # vite build → cap sync → manifest permissions
npx cap open android      # build/run from Android Studio
```
CI (`.github/workflows/android-build.yml`) builds an APK on every push to `main` — download it from the workflow artifacts. APKs are not committed to the repo.

### Brain server (optional, heavy)
```sh
cd brain_server
pip install -r requirements.txt
uvicorn app:app --port 7860
```
Point `BRAIN_SERVER_URL` in `server/.env` at it.

## Project docs
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — issue register and phase-wise plan
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — current state and next steps

## License
MIT
