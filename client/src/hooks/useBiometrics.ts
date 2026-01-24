import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { useState, useEffect } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

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
        if (!isAvailable) return true; // Bypass if not available

        try {
            const result = await NativeBiometric.verifyIdentity({
                reason: "Unlock Aastha",
                title: "Authentication Required",
                subtitle: "Confirm your identity to access your sanctuary",
                description: "Please authenticate to continue"
            });
            return true;
        } catch (error) {
            console.error("Authentication failed", error);
            return false;
        }
    };

    return { isAvailable, isEnabled, toggleBiometrics, promptBiometrics, isLoading };
};
