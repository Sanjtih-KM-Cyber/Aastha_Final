import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// SHARED STATE: Persists across component mounts (Diary vs Guard)
let lastSuccessTime = 0;

export const useBiometrics = () => {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            await Promise.all([checkAvailability(), loadPreference()]);
            setIsLoading(false);
        };
        init();
    }, []);

    const checkAvailability = async () => {
        // WEB GUARD: Do not call native plugin on web
        if (!Capacitor.isNativePlatform()) {
            setIsAvailable(false);
            return;
        }

        try {
            const result = await NativeBiometric.isAvailable();
            setIsAvailable(result.isAvailable);
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
        await Preferences.set({
            key: BIOMETRIC_ENABLED_KEY,
            value: String(enable)
        });
        setIsEnabled(enable);
    };

    const promptBiometrics = async (): Promise<boolean> => {
        // Double check platform availability to be safe
        if (!isAvailable || !Capacitor.isNativePlatform()) return true;

        try {
            const result = await NativeBiometric.verifyIdentity({
                reason: "Unlock Aastha",
                title: "Authentication Required",
                subtitle: "Confirm your identity to access your sanctuary",
                description: "Please authenticate to continue"
            });
            // SUCCESS: Update global timestamp
            lastSuccessTime = Date.now();
            return true;
        } catch (error) {
            console.error("Authentication failed", error);
            return false;
        }
    };

    const isRecentSuccess = (gracePeriodMs = 3000) => {
        return (Date.now() - lastSuccessTime) < gracePeriodMs;
    };

    return { isAvailable, isEnabled, toggleBiometrics, promptBiometrics, isLoading, isRecentSuccess };
};
