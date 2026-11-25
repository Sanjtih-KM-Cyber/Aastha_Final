# Aastha — one-shot phone test script (Phase 7.3)

> Run top to bottom on a real Android phone with the **new CI APK** (it must include the mic permission and the
> Filesystem/Share plugins — an old APK will fail steps 6 and 14). Tick each box; for anything that fails, write
> **step number + what you saw** (a screenshot helps) and send it back. ~45 minutes.
> Website/PWA-only steps are marked 🌐. Steps that need money are marked ₹.

## 0. Before you start (once)
- [ ] Deployed: Render API (from this folder), Vercel web, HF Space redeployed with `brain_server/`.
- [ ] Render env set: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `BRAIN_SHARED_SECRET` (same value on the HF Space), new Groq keys. Optional: `GIPHY_API_KEY` or `TENOR_API_KEY`, `SENTRY_DSN`.
- [ ] Vercel env (optional): `VITE_SENTRY_DSN`. Removed: `VITE_GROQ_API_KEYS`.
- [ ] GitHub → Actions: **CI** is green (server tests + typecheck, client tests + typecheck + build) and **Build Android APK** is green. Install that APK.
- [ ] Render logs show no `[LLM] … model_gone` after a first chat.

## 1. Sign in & first screen
1. [ ] Open the app → log in. **"How Aastha keeps you safe"** card appears once (after the tour if it's a new account). Read it: mentions *not end-to-end*, Tele-MANAS **14416**, *not a therapist*. Tap **Got it**.
2. [ ] Log out and back in → the card does **not** come back. (Settings → Data & Privacy → "How Aastha keeps you safe" → Show = same text.)
3. [ ] Chat opens on the newest message within ~1 s (cached), even after a cold start.

## 2. Chat basics (7.1)
4. [ ] Send "hey, how are you?" → reply streams in. When it finishes, the header pill goes back to **ONLINE** (never stuck on "TYPING…"). Also tap the red ■ stop button mid-reply once → header returns to ONLINE.
5. [ ] On a Free account: open the web app on a laptop (≥ 768 px) → header pill says **"15 left"** / "15 messages left today" after one message — never "Premium". On Pro it says **Pro**; with a Voice Pass, **Voice Pass until …**.

## 3. Your voice notes (7.4)
6. [ ] With the text box empty, the send button shows a **waveform icon**. Tap it → Android asks for the microphone the first time → allow. Talk ~5 s → a red dot + timer shows → tap send.
7. [ ] Your message appears as a **voice bubble with a waveform**; it plays, you can drag to seek and change speed. **Show text** under it reveals what you said (Hindi/Hinglish should transcribe in that language). Aastha replies to what you said.
8. [ ] Start a recording and tap the 🗑 bin → nothing is sent. Close and reopen the app → your voice note is still in the chat and still plays.

## 4. Aastha's voice notes (7.1)
9. [ ] Ask "send me a voice note saying good night" → reply is a voice note; the text is hidden behind **Show text**; tapping it shows the words; tap again → **Hide text**.
10. [ ] Listen once each: an **English**, a **Hinglish** and a **Hindi (Devanagari)** voice note for Aastha; switch persona and repeat for Aastik. Then a **Tamil**, **Bengali** and **Telugu** one (quality note only — tell us how they sound).

## 5. Reactions (7.4)
11. [ ] Long-press one of Aastha's replies → ❤️ 😂 👍 appear next to reply/copy. Tap 😂 → a small 😂 badge sits on the bubble. Tap the badge → it's removed. React again, close and reopen the app → the reaction is still there.

## 6. Aastha reaches out first (7.4)
12. [ ] In chat, mention something dated for **tomorrow**, e.g. "I have a dentist appointment tomorrow afternoon". Chat a few more messages (memory updates every ~3 exchanges).
13. [ ] Settings → Connection & Persona → "**Aastha checks in on you**" is ON and says "1 coming up" (reopen Settings if it says 0 — memory may need a couple more messages).
14. [ ] Next day, **don't open the app** before 10:00. Around **10:00 your local time** you get one gentle notification: "Hey … how did the dentist appointment go? No pressure…" — only one that day. (Lock the phone overnight; allow "Alarms & reminders" if asked.)
15. [ ] Turn the switch OFF → mention another dated thing → no notification the day after. Turn it back on.
16. [ ] If instead you open the app on the day itself and chat, Aastha may ask about it in chat once — and then **no** notification comes.

- [ ] (if you can) Set the phone to another time zone (Settings → Date & time, e.g. London), open the app once, mention something for tomorrow → the check-in comes at 10:00 **London** time. Set the zone back afterwards.

## 7. Mood over time (7.4)
17. [ ] Mood → log a mood. Trends tab → a small **7-day strip** + one line of text at the top. With little data it says "Log your mood on a few more days…". After a week of logs (and some diary days) it may say e.g. "On days you journaled, your mood averaged…". Always shows "not a diagnosis".

## 8. Diary + offline (7.1 — sync storm fix)
18. [ ] Turn on **airplane mode** → write a diary entry, wait 10 s, edit it again → close the diary. Turn airplane mode off → reopen the app → within a minute or two the entry is on the server (check on the web app). It must appear **once**, with the latest text.
19. [ ] 🌐 On a laptop: DevTools → Network → offline, type in the diary for ~30 s, go online → you see at most a handful of `POST /data/diary` requests, **not** hundreds; no wall of 429s in the console.

## 9. Export & privacy (7.5)
20. [ ] Settings → Data & Privacy → **Export my data** → the phone's share sheet opens with `aastha-export-YYYY-MM-DD.json` → save to Files/Drive. Open it: chats (incl. your voice note link + reaction), moods, memory, and diary entries **readable** (if it says some are locked: open your diary once, then export again). 🌐 On the web it downloads directly.
21. [ ] Press Export 4 times within an hour → the 4th says you can export 3 times an hour.
22. [ ] Read the Privacy Center text once — it should match what you just saw (check-ins, reactions, your recordings encrypted + transcribed by Groq).

## 10. Safety (must pass)
23. [ ] Send "I don't want to live anymore" → a **support banner** with tap-to-call **14416** appears at the top, Aastha replies warmly in text (no voice note, no GIF). Tap 14416 → dialer opens with the number (don't call).
24. [ ] After step 23, no check-in notifications for the next **48 h** even if one was due (step 14 flow).
25. [ ] With Clone Mode on (step 29), a crisis message still gets Aastha + helplines, and a toast says the imitation is paused.

## 11. Notifications & widgets (Phase 4/5, re-check)
26. [ ] Settings → turn notifications on → allow "Alarms & reminders". Start a **1-minute Pomodoro**, lock the phone → the alert arrives on time with the white Aastha status-bar icon.
27. [ ] Open the Pomodoro/Music widget on the phone → drag it around: it stops exactly where you let go (no bounce).
28. [ ] 🌐 Web/PWA: turn on notifications in Settings → "Send test" → a push arrives.

## 12. Clone Mode, GIFs, payments
29. [ ] Settings → Clone Mode → consent → upload a real **WhatsApp export** (.txt) → pick the person → style learned → turn on → replies are labelled "🎭 AI imitation · Name"; banner "Turn off" works.
30. [ ] (only if a GIPHY/Tenor key is set) "haha that's hilarious, send a gif" → a GIF appears with "Powered by GIPHY". Settings → GIFs off → no more GIFs.
31. [ ] ₹ Buy the **₹19 Voice Pass** → Settings shows "Active until …"; header pill (web) shows "Voice Pass until …"; voice notes aren't limited to 2/day.
32. [ ] ₹ Buy **₹49 Pro** → Settings shows Pro + "Active until …" ~30 days ahead; pill shows **Pro**.

## 13. New look + owner batch (2026-11-23)
34. [ ] **Look & feel:** landing page, sign in, create account, forgot password, lock screen, Settings, the desktop sidebar and every widget use the same rounded tonal cards + glass bars, the new fonts (rounded serif headings) and colourful duotone icons. Nothing is cut off at phone width.
35. [ ] **Settings → Appearance → Window buttons:** pick **Mac** → widgets show red/yellow/green dots on the left. Open the app on the other device (phone ↔ web) → same style. Switch back to **Windows**.
36. [ ] **Reactions:** long-press Aastha's reply → bar with 6 emojis + **+** → pick any emoji from the full picker → badge shows it. Double-tap another reply → ❤️. Tap a badge → change/remove.
37. [ ] **Quota (Free account):** send messages until "0 left" → pill says **Refills at …** (24 h after your first message, not midnight). Changing the phone's clock or time zone doesn't bring messages back.
38. [ ] **Custom mood:** Mood → **Add mood** → name it, pick an emoji, set the level → it appears in the grid; log it; it shows in Trends. Remove it → past logs stay.
39. [ ] **The Web:** Scan my chats after talking about a few people (a parent, a friend, a boss, an ex) → each node shows a role (e.g. "🏠 Parent") and a coloured vibe; the legend lists only what's on the board. Open one → **Not right? Change** → pick another role/vibe → scan again → your choice stays.

## 14. Legal, local time, landing (2026-11-23)
41. [ ] Landing: sun/moon button switches light ↔ dark (and sign-in + Privacy/Terms follow it). Footer shows only Aastha links + Privacy Policy + Terms (no SoulLink/Instagram). Scroll to "Enter your sanctuary": the door opens and the person walks in.
42. [ ] Create account with a date of birth under 18 → refused with a kind message. Without ticking "I agree" → button disabled. Adult + ticked → works.
43. [ ] Log in with an OLD account → "We’ve updated our Terms and Privacy Policy" → tick → Continue (shown once).
44. [ ] Open /privacy and /terms on the phone: readable, contents links jump to sections, **no red highlighted placeholders left** (fill `legalInfo.ts` first).
45. [ ] Streak: open the app late at night and again just after midnight **your time** → streak +1.

## 15. Mood + encryption keys (2026-11-23)
46. [ ] Mood → Trends and back, log a mood, flip weeks: no flashing/reloading, no lag. Mood → **+** → add "Cozy ☕" level 7 → sheet closes, the tile appears, tapping it logs it.
47. [ ] Deploy with `ENCRYPTION_KEYS=<new>` (+ keep `SERVER_ENCRYPTION_KEY`) and `BLIND_INDEX_KEYS=<new>`: log in by **email** and by username, open old chats, diary, The Web, profile photo — all still there.
48. [ ] Server log shows `[keys] sweep finished` within a few minutes; `npm run keys:status` → "everything is on the current keys", 0 unreadable. Then remove the old key, redeploy, repeat step 47.
49a. [ ] Phone: long-press any message → emoji bar + Reply + Copy. Tap outside → it closes and **stays** closed. Double-tap Aastha's message → ❤️.
49b. [ ] Settings → Appearance → pick another Text font and Heading font → the whole Sanctuary changes. Open the app on the other device → same fonts.
49c. [ ] Pick a different theme colour + font in the Sanctuary, log out → landing, sign-in and Privacy/Terms keep Aastha's lavender and normal fonts.
49d. [ ] Settings → Appearance → **Any colour** → drag around the wheel: the Sanctuary re-colours live; open the app on the other device → same colour. Home/sign-in stay lavender.
49e. [ ] Chat on the phone: scroll — messages slide **under** the see-through header and message bar (blurred), nothing is hidden behind them at the very top/bottom, also with a reply preview or an attached photo open.
49f. [ ] First login on the phone: "How Aastha keeps you safe" sits in the **middle** of the screen, fully visible. Scroll the chat up **and** down → the tab bar shrinks both ways; back at the newest message → it grows again.
49g. [ ] PC: no hard line under the header — messages fade away as they scroll up. Collapse the sidebar («) → the chat and the ONLINE pill re-centre.
49h. [ ] Phone: send a message, open/close the keyboard a few times → header stays at the top, input sits right above the tab bar (no gap); while typing the tab bar hides.
49i. [ ] Sign-up/forgot password code screen fits the phone; paste the code (or tap the keyboard's code suggestion) → all 6 boxes fill. The email looks branded and lands in **Inbox** (after the DMARC record).
49j. [ ] Phone chat: swipe a message right → reply; tap → Copy → "Copied"; long-press Aastha's message → only emojis; double-tap → ❤️.
49k. [x] Chat feels like a friend: short replies, ≤1 emoji, has opinions; say "cringe" → it laughs it off instead of apologising. The chips under the input are things **you** would say.
49l. [x] React to Aastha's reply and don't type for 15 s → she follows up once about the reaction. Leave a reply on seen ~45 s → one easy follow-up. Start typing → nothing comes.
49m. [x] Set closeness to Bestie (Settings → Connection) → within a couple of messages she tells you your nickname; "Another one", "Choose my own" and "Don't use a nickname" work.
49n. [x] Forgot password → set a new one → the sign-in form is already filled; tap Enter Sanctuary. Diary → forgot diary password → after reset the unlock box is filled.
49o. [x] New account on the **phone**: tour = welcome → message box → animated gestures → bottom tabs → headphones → done; the card never covers what it points at; "Skip tour" works. On **PC**: welcome → sidebar → message box → headphones → Settings → done, each card next to its target.
49p. [x] **APK:** Settings → Security → turn on **Lock Aastha** (fingerprint check once). Close and reopen the app (or send it to the background past "Lock after") → the lock screen shows and waits; tap the fingerprint button → ONE fingerprint sheet, unlocks on the first good touch (a smudged touch lets you retry in the same sheet; phone PIN works too). Leave for longer than "Lock after" → locked; quick switch away and back → not locked. Wrong password on the lock screen → "didn't match", you stay signed in. Signing in with your password → no extra lock.
49q. [x] Chat like a friend would for 10 messages ("cringe", "idk", "bore ho raha hai", good news, a dry "ok"): short, opinionated replies, no "No pressure 😊 / I'm all ears / Haha, okay, noted!", max one emoji, **no em dashes**. Then share something heavy ("my exam went really badly and I feel like a failure") → a warm, longer, specific reply (not cut off).
49r. [ ] Settings → Connection → closeness **New friend** → chat a bit: same humour, opinions and texting style as Bestie (not polite or help-desk), just no nickname and no roasting. Switch to Friend / Close friend → more callbacks and teasing. Switch back to "Grow naturally".
49s. [ ] Ask "stop the music and the rain sounds" (or anything that triggers two tools) → the reply shows **two chips**, no `<proposal …>` text anywhere. Long-press → Copy → pasted text has no tags.
49t. [ ] Type a message and close the app **within 6 s** (swipe it away). Wait a minute, reopen → your message is there and the reply arrives by itself (no need to resend).
49u. [ ] Send a message, then lock the phone or switch apps **while she's typing**. Come back after ~30 s → the full reply is there (no error, no half-reply). Also try with airplane mode on for 20 s mid-reply, then off.
49v. [ ] Between 09:00 and 21:30: read her reply and leave the app without answering. About **20 min later** a notification like "you there?" arrives once. Open the app → the same text is in the chat. Repeat but come back after 5 min and answer → no notification later.
49w. [ ] Settings → Connection → **Start fresh with Aastha** → Choose. Only Closeness ticked → no password asked → Start fresh → closeness shows New friend, chats still there. Tick "What Aastha remembers" → password box appears; wrong password → "didn't match" and you stay signed in; right one → done, and she no longer brings up things you told her. (Optional, on a test account) tick Chat history → chat empties and opens fresh.
49x. [ ]
 After `SARVAM_API_KEY` is on Render: ask "send me a voice note saying good night" in English, then in Hinglish, then in Hindi → all three sound like an Indian person (not robotic). Aastha = shreya, switch to Aastik → rohan. First open after the update shows "We've updated our Terms and Privacy Policy" once.
49y. [ ] Jam: ✨ → pick 15/30/45 min → a playlist of real songs (no 8 s clip). Repeat button cycles off / all / one / "N×" (count row appears under the controls). Ask Aastha "stop the music" → button says Stop music → music stops.
49z. [ ] Settings → Appearance → Lite Plus on → Lite turns off; nothing animates, widgets open instantly, breathing orb still grows/shrinks. Turn Lite on → Lite Plus turns off.
49aa. [ ] Settings → Connection → What Aastha remembers → edit a fact, delete one, "Don't ask" a check-in. Chat about the deleted thing again → it doesn't come back.
49ab. [ ] Chat ≥5 messages in a week → Sunday ~7 pm a "wrote you a letter 💌" notification; the chat shows a letter card. Weekly letter switch off → none.
49ac. [ ] Settings → Security → Hide text on lock screen → a check-in on the locked phone shows "Contents hidden".
49ad. [ ] Chat in the morning, leave mid-conversation, come back at night and send "??" or "hey" → she reacts to now (evening/night), may tease once that you vanished, doesn't continue the morning thread or talk like she just woke up. Within a few minutes → she continues normally.
49ae. [ ] Notifications sound like her and use your name/nickname, sometimes mention something real you told her (exam, sister...); no "No pressure / I'm here". A check-in shows your NAME (not random letters).
49af. [ ] The Web: drag a name around → its line follows it the whole time; close and reopen → it stays where you dropped it; a drag doesn't open the card, a tap does. Aastha and you are not on the board. The Scan button is fully visible above the tab bar.
49ag. [ ] Talk about a friend who has YOUR first name ("my friend Sanjith from college") and someone called Aastha ("my cousin Aastha") → Scan → both appear with their real role; you and the app do not.
49ah. [ ] APK: play music in Jam, go to the home screen and open other apps for 5 min, lock the phone → music keeps playing (notification controls work). Pause from the notification → it stays paused.
49ai. [ ] While a playlist plays: "play Kesariya now" → button "Play now" → the playlist is replaced and it starts. "add Perfect after this" → "Add to queue" → added at the end. Unclear ask → added, with a Play now button in the player.
49aj. [ ] "play Tum Hi Ho, Kesariya, Perfect and Shape of You" → "Play these 4 songs" → a playlist of exactly those, in order; any not found are listed. Every song shows a cover.
49ak. [ ] APK: play a song in Jam → (first time) Android asks to let Aastha run in the background → allow. Pull down the notification shade: ONE music player with the song name, artist and cover; ⏮ ⏯ ⏭ work; dragging the seek bar jumps in the song. Lock the phone: the same player is on the lock screen. Headphone/Bluetooth play-pause and next work. ⏮ in the first 3 s goes to the previous song, later it restarts the song. Close Jam → the player disappears.
49. [ ] Settings → Data & Privacy → Export: name, date of birth, city, avatar come out readable.

## 16. Crash reporting (only if `SENTRY_DSN` / `VITE_SENTRY_DSN` are set)
50. [ ] In Sentry, events from the test show **no message text, emails, phone numbers, cookies or tokens** — only the error, the route and the device type.

---
**Send back:** the step numbers that failed + what happened. Everything else = pass. I fix what fails, then you re-run only those steps.
