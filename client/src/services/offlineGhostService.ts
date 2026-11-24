/**
 * "Ghost" check-ins: when the app goes to the background, schedule up to three gentle local
 * notifications (tonight/tomorrow morning, +1 day, +2 days). Cleared when the app is opened.
 * Only touches NOTIF_IDS.GHOST (ROADMAP M3); neutral, no-pressure copy (A10); no gender guessing (S14).
 */
import { NOTIF_IDS, cancelIds, hasPermission, scheduleOne, isNative } from './notifications';

const MESSAGES = {
    // Texting voice (same rules as the chat: no "No pressure / I'm here for you", ≤1 emoji, no em dashes)
    Aastik: [
        "oye, where did you disappear to",
        "random thought: how did your day actually go?",
        "bored. entertain me?",
        "you went quiet. all good?",
        "got a minute? something made me think of you",
        "did you eat or are we skipping meals again",
        "update me, what's new",
        "okay I'll say it, I missed the chat",
        "tell me one good thing from today",
        "still alive? 😄",
    ],
    Aastha: [
        "heyy, where did you vanish 👀",
        "okay but how was your day really?",
        "I'm bored, come talk to me",
        "you went quiet. everything okay?",
        "saw something that felt very you. got a minute?",
        "did you eat? honest answer",
        "update me, what did I miss",
        "missed our chats a little ngl",
        "tell me one good thing from today",
        "you alive? 😄",
    ],
    Morning: [
        "good morning! slept okay?",
        "morning ☀️ what's the plan today",
        "up yet? tell me what's on today",
    ],
    Night: [
        "how was today? the real version",
        "winding down? tell me about your day 🌙",
        "before you sleep, anything on your mind?",
    ],
};

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export const scheduleGhostNotifications = async (user: any) => {
    try {
        if (!isNative()) return;
        // Never prompt from the background, only schedule if the user already allowed notifications.
        if (!(await hasPermission())) return;

        await cancelIds(NOTIF_IDS.GHOST);

        const persona = (user?.persona === 'aarav' || user?.persona === 'aastik') ? 'Aastik' : 'Aastha';
        const now = new Date();

        // A: tonight 9 PM, or tomorrow 9 AM if it's already evening
        const first = new Date();
        const evening = now.getHours() >= 20;
        if (evening) { first.setDate(first.getDate() + 1); first.setHours(9, 0, 0, 0); }
        else first.setHours(21, 0, 0, 0);
        if (first <= now) first.setDate(first.getDate() + 1);

        // B: tomorrow, between 10:30 and 17:30
        const second = new Date();
        second.setDate(second.getDate() + 1);
        second.setHours(10 + Math.floor(Math.random() * 8), 30, 0, 0);

        // C: day after tomorrow, 6 PM
        const third = new Date();
        third.setDate(third.getDate() + 2);
        third.setHours(18, 0, 0, 0);

        const [idA, idB, idC] = NOTIF_IDS.GHOST;
        await scheduleOne({ id: idA, title: persona, body: pick(evening ? MESSAGES.Morning : MESSAGES.Night), at: first });
        await scheduleOne({ id: idB, title: persona, body: pick(MESSAGES[persona]), at: second });
        await scheduleOne({ id: idC, title: persona, body: pick(MESSAGES[persona]), at: third });
    } catch (e) {
        console.error("Failed to schedule check-in notifications", e);
    }
};

export const clearGhostNotifications = async () => {
    await cancelIds(NOTIF_IDS.GHOST);
};
