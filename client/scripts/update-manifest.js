const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
    console.log('AndroidManifest.xml not found. Skipping automation (Platform might not be added yet).');
    process.exit(0);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
let changed = false;

const PERMISSIONS = [
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />' // Android 14 requirement
];

// 1. Inject Permissions
PERMISSIONS.forEach(perm => {
    if (!manifest.includes(perm)) {
        console.log(`Adding Permission: ${perm}`);
        // Insert before the first <application> tag
        manifest = manifest.replace('<application', `${perm}\n    <application`);
        changed = true;
    }
});

// 2. Inject Service (if needed for older background mode versions, but modern ones usually merge)
// Checking if the plugin requires manual service entry.
// @anuradev/capacitor-background-mode typically relies on auto-merge, but let's be safe.
// Standard configuration often requires nothing extra if the plugin.xml is correct.

if (changed) {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('AndroidManifest.xml updated successfully.');
} else {
    console.log('AndroidManifest.xml is already up to date.');
}
