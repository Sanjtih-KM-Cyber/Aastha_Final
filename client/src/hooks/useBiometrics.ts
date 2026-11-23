import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'; // "Lock Aastha" on a phone (also lets the Diary unlock with a fingerprint)

// SHARED STATE: persists across component mounts (Diary vs lock screen)
let lastSuccessTime = 0;
let inFlight: Promise<boolean> | null = null; // ONE system prompt at a time, app-wide
// The "enabled" preference is SHARED live between every component using this hook. Before, each copy read it once
// at mount, so turning the lock on in Settings left the lock screen thinking fingerprint was off (password only).
const prefListeners = new Set<(v: boolean) => void>();

export type BiometricKind = 'fingerprint' | 'face' | 'biometric';

export const useBiometrics = () => {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [kind, setKind] = useState<BiometricKind>('biometric');

    useEffect(() => {
        const init = async () => {
            await Promise.all([checkAvailability(), loadPreference()]);
            setIsLoading(false);
        };
        init();
        prefListeners.add(setIsEnabled);
        return () => { prefListeners.delete(setIsEnabled); };
    }, []);

    const checkAvailability = async () => {
        if (!Capacitor.isNativePlatform()) { setIsAvailable(false); return; } // web: password lock instead
        try {
            const result = await NativeBiometric.isAvailable({ useFallback: true });
            setIsAvailable(result.isAvailable);
            const t = result.biometryType;
            setKind(t === BiometryType.FACE_ID || t === BiometryType.FACE_AUTHENTICATION ? 'face'
                : t === BiometryType.FINGERPRINT || t === BiometryType.TOUCH_ID ? 'fingerprint' : 'biometric');
        } catch (e) {
            console.log('Biometric not available:', e);
            setIsAvailable(false);
        }
    };

    const loadPreference = async () => {
        const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
        setIsEnabled(value === 'true');
    };

    const toggleBiometrics = async (enable: boolean) => {
        await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: String(enable) });
        prefListeners.forEach((fn) => fn(enable)); // every screen updates at once (lock screen, Diary, Settings)
    };

    /**
     * Shows the system prompt ONCE. Up to 5 tries inside the same sheet (the plugin's default was 1, so one
     * smudged touch closed it and you had to start over = "it takes 2 times"), and the phone's PIN/pattern as a
     * fallback. Concurrent callers share the same prompt instead of stacking a second one.
     */
    const promptBiometrics = async (): Promise<boolean> => {
        if (!isAvailable || !Capacitor.isNativePlatform()) return true;
        if (inFlight) return inFlight;
        inFlight = (async () => {
            try {
                await NativeBiometric.verifyIdentity({
                    reason: 'Unlock Aastha',
                    title: 'Unlock Aastha',
                    subtitle: 'Your sanctuary is locked',
                    description: '',
                    negativeButtonText: 'Use password',
                    useFallback: true,   // phone PIN / pattern if the sensor won't cooperate
                    maxAttempts: 5,
                });
                lastSuccessTime = Date.now();
                return true;
            } catch (error) {
                console.warn('Authentication cancelled or failed', error);
                return false;
            } finally {
                setTimeout(() => { inFlight = null; }, 0);
            }
        })();
        return inFlight;
    };

    const isRecentSuccess = (gracePeriodMs = 3000) => (Date.now() - lastSuccessTime) < gracePeriodMs;

    return { isAvailable, isEnabled, toggleBiometrics, promptBiometrics, isLoading, isRecentSuccess, kind };
};
