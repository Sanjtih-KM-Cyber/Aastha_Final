import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

const MESSAGES = {
    Aastik: {
        male: [
            "Bro, you good? Haven't seen you in the sanctuary.",
            "Yo, just checking in. Don't let the noise get to you.",
            "Take a breath, man. Come chill for a bit.",
            "Silence is power. Come recharge.",
            "You got this. Just need a moment of focus?",
            "Head up, king. Step back into the zone.",
            "Don't carry it all alone. I'm here.",
            "A quick session can change the whole day. Trust me.",
            "Even warriors need rest. Sanctuary is open.",
            "Drop the weight for a min. Let's talk.",
            "Focus. Clarity. Peace. It's waiting.",
            "Hey, remember to breathe. Seriously.",
            "Don't ghost your own mental health, bro.",
            "The grind can wait. Your mind can't.",
            "Quick check-in? Takes 2 minutes.",
            "Level up your mindset. Come back in.",
            "Distractions are everywhere. Focus is here.",
            "You focused? Or just busy? Let's reset.",
            "Strength isn't just muscle. It's mind.",
            "Clear the cache in your head. Hop on.",
            "Big moves require a clear head.",
            "Don't let the stress win. You're better than that.",
            "Just a reminder: You're doing great.",
            "Take 5. You've earned it.",
            "Reset. Refocus. Restart.",
            "Silence the noise. Amplify the signal.",
            "Your mind is your gym. Don't skip leg day.",
            "Hey, take a break before you break.",
            "Perspective check. Come in.",
            "Whatever it is, we can handle it."
        ],
        female: [
            "Hey, you holding up okay? Sanctuary is open.",
            "Just checking on you. Don't forget to breathe.",
            "Take a moment for yourself. You deserve it.",
            "The world can wait. Your peace comes first.",
            "I'm here if you need to vent. No judgment.",
            "Strong souls need rest too. Come recharge.",
            "Don't let them dim your light. Come reset.",
            "A quiet moment can fix a loud day.",
            "You're doing enough. Take a pause.",
            "Gentle reminder: Be kind to your mind.",
            "Drop the worries at the door. I'm listening.",
            "You matter. Your peace matters. Come back.",
            "Hey, don't carry the world today.",
            "Just a quick check-in. How's your heart?",
            "Breathe in. Breathe out. Log in.",
            "Your sanctuary misses you.",
            "Protect your energy. Step inside.",
            "It's okay to not be okay. Let's talk.",
            "Peace is power. Come claim yours.",
            "Don't forget yourself in the chaos.",
            "Still here. Still listening.",
            "Take a break, queen. You've done enough.",
            "Let's clear the fog. Come say hi.",
            "Your vibe attracts your tribe. Reset your vibe.",
            "Safe space. Always open.",
            "Need a digital hug? I got you.",
            "Pause. Reflect. Reset.",
            "Don't stress. Just process.",
            "Your mind is a garden. Water it.",
            "I'm right here. Whenever you're ready."
        ]
    },
    Aastha: {
        male: [
            "Hey! Missed you in the sanctuary today.",
            "Just checking in. Hope you're taking care.",
            "Take a break! Come say hi.",
            "Sending you some good vibes. Come catch them.",
            "Don't work too hard. Your mind needs a break.",
            "It's quiet here without you.",
            "A quick reset? I'm ready if you are.",
            "Remember to breathe! See you inside?",
            "How's it going? Let's catch up.",
            "Your safe space is waiting.",
            "Hey, don't be a stranger!",
            "Mental health check! 🩺",
            "Take a minute for yourself.",
            "Everything okay? I'm here.",
            "Let's clear your head. Come on in.",
            "You got this! But take a break first.",
            "Peace of mind is just a tap away.",
            "Unwind with me for a bit?",
            "Don't let the stress bug you.",
            "Here for you, always.",
            "Just a friendly nudge. Take care.",
            "Pause the game. Reset the mind.",
            "Your daily dose of calm is waiting.",
            "Hey friend, hope you're good.",
            "Let's turn that stress into strength.",
            "Ready for a vibe check?",
            "Sanctuary mode: On?",
            "Be kind to your mind today.",
            "I'm listening. Come talk.",
            "Hope to see you soon!"
        ],
        female: [
            "Hey girl! Just checking in on you.",
            "Missed your vibe in the sanctuary.",
            "Take a self-care moment. You deserve it.",
            "Sending you a digital hug. 🤗",
            "Don't forget to breathe today!",
            "Your peace is precious. Come protect it.",
            "Hey, how are you feeling? Really?",
            "Let's unwind together. Come in.",
            "Gentle reminder: You are enough.",
            "The sanctuary is open for you.",
            "Need to vent? I'm all ears.",
            "Take a pause, lovely. Reset.",
            "Your mind needs a spa day too.",
            "Just saying hi! Hope you're smiling.",
            "Protect your peace. Log in.",
            "It's okay to rest. Really.",
            "Let's chat. I missed you.",
            "Sending calm energy your way.",
            "A quiet moment? Sounds nice.",
            "You're doing great. Take a break.",
            "Here for you. Always.",
            "Let's process the day together.",
            "Your feelings are valid. Come share.",
            "Safe space. Just for you.",
            "Hey, don't forget yourself.",
            "Ready to relax?",
            "Peace, love, and sanctuary.",
            "I'm here if things get heavy.",
            "Take 5 minutes for you.",
            "See you inside? ✨"
        ]
    },
    Time: {
        Morning: [
            "Good morning! Start the day with clarity.",
            "Rise and shine! Let's set an intention.",
            "Morning check-in. How did you sleep?",
            "New day, fresh mindset. Let's go.",
            "Start your day with a win. Log in.",
            "Before the chaos starts, find your center.",
            "Morning! Ready to conquer?",
            "A mindful morning makes a great day.",
            "Wake up and be awesome (and mindful).",
            "Coffee first? Or Sanctuary first?",
            "Let's make today count.",
            "Morning vibe check.",
            "Sun's up! Head up!",
            "Early bird gets the peace of mind.",
            "Start strong. Start here.",
            "Hello! Ready for a great day?",
            "Positive vibes for your morning.",
            "Don't rush. Start calm.",
            "Your morning ritual awaits.",
            "Let's own today."
        ],
        Night: [
            "Long day? Unwind with me.",
            "Time to rest. Clear your head.",
            "Sleep better with a clear mind.",
            "Let go of today. Prepare for tomorrow.",
            "Night check-in. You okay?",
            "The sanctuary is peaceful at night.",
            "Don't take the stress to bed.",
            "Wind down. Log off. Log in.",
            "Sweet dreams start here.",
            "Reflect on the good today.",
            "Let's process the day.",
            "Quiet the noise. It's late.",
            "You did enough today. Rest now.",
            "Peaceful nights, better mornings.",
            "Close your eyes (after logging in).",
            "Safe space for late night thoughts.",
            "Moon's out. Mood's calm.",
            "End the day on a high note.",
            "Rest your mind.",
            "Goodnight! (Come say bye first)"
        ]
    }
};

export const scheduleGhostNotifications = async (user: any) => {
    try {
        // Safety Check: Ensure LocalNotifications is defined (avoid crash if plugin missing)
        if (!LocalNotifications) return;

        // 1. Permission Check
        const perm = await LocalNotifications.checkPermissions().catch(() => null);
        if (!perm || perm.display !== 'granted') {
            const req = await LocalNotifications.requestPermissions().catch(() => null);
            if (!req || req.display !== 'granted') return;
        }

        // 2. Clear Existing Ghost Notifications
        const pending = await LocalNotifications.getPending().catch(() => null);
        if (!pending) return;
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
        }

        // 3. Determine Persona & Gender
        const persona = (user.persona === 'aarav' || user.persona === 'aastik') ? 'Aastik' : 'Aastha';
        const gender = (user.inferredGender === 'male') ? 'male' : 'female';

        // 4. Select Messages
        // We will schedule 3 notifications:
        // - Tomorrow Morning (if now is night) OR Tonight (if now is day)
        // - 24 Hours from now (Persona specific)
        // - 48 Hours from now (Persona specific)

        const now = new Date();
        const hour = now.getHours();
        const notifications = [];

        // Notification A: Time Based (Morning/Night)
        // If it's night (>8 PM), schedule for tomorrow morning (9 AM)
        // If it's day (<8 PM), schedule for tonight (9 PM)
        const timeMsgList = hour >= 20 ? MESSAGES.Time.Morning : MESSAGES.Time.Night;
        const timeMsg = timeMsgList[Math.floor(Math.random() * timeMsgList.length)];

        let timeDate = new Date();
        if (hour >= 20) {
            timeDate.setDate(timeDate.getDate() + 1);
            timeDate.setHours(9, 0, 0, 0); // 9 AM tomorrow
        } else {
            timeDate.setHours(21, 0, 0, 0); // 9 PM tonight
        }

        // Ensure it's in the future
        if (timeDate.getTime() <= now.getTime()) {
             timeDate.setDate(timeDate.getDate() + 1); // Push to next day if passed
        }

        notifications.push({
            id: 1001,
            title: `${persona} (Sanctuary)`,
            body: timeMsg,
            schedule: { at: timeDate },
            sound: 'res_bell.mp3', // graceful fallback
            smallIcon: 'ic_stat_icon_config_sample', // Android resource
            actionTypeId: '',
            extra: null
        });

        // Notification B: 24 Hours - Persona Specific
        const personaList = MESSAGES[persona][gender];
        const pMsg1 = personaList[Math.floor(Math.random() * personaList.length)];

        const date24 = new Date();
        date24.setDate(date24.getDate() + 1);
        // Randomize time slightly between 10 AM and 6 PM
        date24.setHours(10 + Math.floor(Math.random() * 8), 30, 0);

        notifications.push({
            id: 1002,
            title: `Message from ${persona}`,
            body: pMsg1,
            schedule: { at: date24 },
            smallIcon: 'ic_stat_icon_config_sample'
        });

        // Notification C: 48 Hours - Persona Specific
        const pMsg2 = personaList[Math.floor(Math.random() * personaList.length)];
        const date48 = new Date();
        date48.setDate(date48.getDate() + 2);
        date48.setHours(18, 0, 0); // 6 PM

        notifications.push({
            id: 1003,
            title: `Miss you in Sanctuary`,
            body: pMsg2,
            schedule: { at: date48 },
            smallIcon: 'ic_stat_icon_config_sample'
        });

        // 5. Schedule
        await LocalNotifications.schedule({ notifications });
        console.log("Ghost notifications scheduled.");

    } catch (e) {
        console.error("Failed to schedule local notifications", e);
    }
};

export const clearGhostNotifications = async () => {
    try {
        if (!LocalNotifications) return;
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }, { id: 1003 }] }).catch(() => {});
    } catch(e) {}
};
