/**
 * "Ghost" check-ins: when the app goes to the background, schedule up to three gentle local
 * notifications (tonight/tomorrow morning, +1 day, +2 days). Cleared when the app is opened.
 * Only touches NOTIF_IDS.GHOST (ROADMAP M3); neutral, no-pressure copy (A10); no gender guessing (S14).
 */
import { NOTIF_IDS, cancelIds, hasPermission, scheduleOne, isNative } from './notifications';

const MESSAGES = {
    Aastik: [
        "Hey, just checking in. No pressure.",
        "Quiet day? I'm around if you want to talk.",
        "Take a breath. You're doing better than you think.",
        "Don't carry it all alone. I'm here.",
        "Whatever it is, we can figure it out together.",
        "Remember to drink some water and rest a bit.",
        "No agenda, just here if you need a sounding board.",
        "Hope today's been kind to you.",
        "Five quiet minutes can reset a whole day.",
        "Still here. Whenever you're ready.",
    ],
    Aastha: [
        "Hey you, just thinking of you. No need to reply 💜",
        "How's your heart today? I'm here if you want to talk.",
        "Gentle reminder: be kind to yourself today.",
        "It's okay to not be okay. I'm listening, whenever.",
        "Take a little pause. You've been doing a lot.",
        "A quiet moment can fix a loud day.",
        "No pressure at all, just saying hi 🌸",
        "You matter. That's the whole message.",
        "Hope you're resting a little today.",
        "Still here. Whenever you're ready.",
    ],
    Morning: [
        "Good morning ☀️ Wishing you an easy day.",
        "Morning! Take today one small step at a time.",
        "New day, fresh start. I'm around if you need me.",
    ],
    Night: [
        "Winding down? Tell me about your day if you like 🌙",
        "Hope you can rest tonight. I'm here if your mind is busy.",
        "Before you sleep: you did enough today.",
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
