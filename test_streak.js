const today = new Date();
// Mock yesterday (24h ago)
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

// Mock 2 days ago
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(today.getDate() - 2);

function calculateStreak(lastVisitStr, currentStreak) {
    const now = new Date();
    const lastVisit = new Date(lastVisitStr);

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastVisitMidnight = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());

    const diffTime = Math.abs(todayMidnight.getTime() - lastVisitMidnight.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // This logic seems fragile

    console.log(`Last Visit: ${lastVisit.toISOString()}, DiffTime: ${diffTime}, DiffDays: ${diffDays}`);

    let newStreak = currentStreak;
    if (diffDays === 1) {
        newStreak = currentStreak + 1;
        console.log("Incremented!");
    } else if (diffDays > 1) {
        newStreak = 1;
        console.log("Reset!");
    } else {
        console.log("Same day, no change.");
    }
    return newStreak;
}

console.log("--- Test 1: Yesterday to Today ---");
calculateStreak(yesterday.toISOString(), 5);

console.log("--- Test 2: Two Days Ago to Today ---");
calculateStreak(twoDaysAgo.toISOString(), 5);

console.log("--- Test 3: Today to Today ---");
calculateStreak(today.toISOString(), 5);

// Test 4: 1.5 days ago (e.g., visited at 10 AM yesterday, now it is 10 PM today)
// Midnight comparison should still be 1 day difference.
const yesterdayMorning = new Date();
yesterdayMorning.setDate(today.getDate() - 1);
yesterdayMorning.setHours(10, 0, 0, 0);
console.log("--- Test 4: Yesterday Morning to Today (Late) ---");
calculateStreak(yesterdayMorning.toISOString(), 5);
