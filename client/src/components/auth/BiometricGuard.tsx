import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { useBiometrics } from '../../hooks/useBiometrics';
import { LoadingFallback } from '../LoadingFallback';
import { useNavigate } from 'react-router-dom';

interface BiometricGuardProps {
    children: React.ReactNode;
}

export const BiometricGuard: React.FC<BiometricGuardProps> = ({ children }) => {
    const { isEnabled, promptBiometrics, toggleBiometrics, isLoading } = useBiometrics();
    const [isLocked, setIsLocked] = useState(false);
    const [hasCheckedInitial, setHasCheckedInitial] = useState(false);
    const lastVerifiedRef = React.useRef<number>(0);
    const navigate = useNavigate();

    // Reusable Safe Check Logic
    const performSafeBiometricCheck = async () => {
        if (!isEnabled) return true;

        setIsLocked(true);
        const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
                console.warn("Biometric prompt timed out.");
                resolve(false);
            }, 30000);
        });

        try {
            const success = await Promise.race([
                promptBiometrics(),
                timeoutPromise
            ]);
            setIsLocked(!success);
            if (success) {
                lastVerifiedRef.current = Date.now();
            }
            return success;
        } catch (e) {
            console.error("Biometric check failed", e);
            setIsLocked(true); // Fail Safe
            return false;
        }
    };

    useEffect(() => {
        if (isLoading) return;

        // Initial Check
        if (!hasCheckedInitial) {
            if (isEnabled) {
                performSafeBiometricCheck().then(() => setHasCheckedInitial(true));
            } else {
                setIsLocked(false);
                setHasCheckedInitial(true);
            }
        }

        // Listen for App Resume
        const listener = App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive && isEnabled) {
                // GRACE PERIOD CHECK:
                // If we just verified (e.g., the prompt closing triggered 'resume'), ignore it.
                // 3000ms is generous enough to cover the prompt transition but short enough to be secure.
                if (Date.now() - lastVerifiedRef.current < 3000) {
                    console.log("Biometric check skipped (Grace Period)");
                    return;
                }

                // On Resume, wait a moment for the app to settle (Fix for S23/Android lag)
                setTimeout(async () => {
                   await performSafeBiometricCheck();
                }, 500);
            }
        });

        return () => {
             listener.then(l => l.remove());
        };
    }, [isEnabled, isLoading, hasCheckedInitial]);

    if (isLoading || !hasCheckedInitial) return <LoadingFallback />;

    if (isLocked) {
        return (
            <div className="fixed inset-0 z-50 bg-midnight flex flex-col items-center justify-center text-white">
                <div className="w-20 h-20 rounded-full bg-violet-600/20 flex items-center justify-center animate-pulse mb-6">
                    <span className="text-4xl">🔒</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">Sanctuary Locked</h2>
                <p className="text-white/50 mb-8">Authentication required</p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={async () => {
                            const success = await promptBiometrics();
                            setIsLocked(!success);
                        }}
                        className="px-8 py-3 bg-violet-600 rounded-full font-bold hover:bg-violet-700 transition-colors"
                    >
                        Try Again
                    </button>

                    {/* Fallback for "Disaster" scenarios where sensor fails */}
                    <button
                        onClick={async () => {
                            // Emergency bypass: Disable the broken biometric setting AND logout
                            // We MUST await this to ensure the preference is saved before we reload
                            await toggleBiometrics(false);
                            setIsLocked(false);
                            localStorage.removeItem('userInfo');
                            // Force a hard reload to clear any stuck native plugin state
                            window.location.replace('/login');
                        }}
                        className="text-sm text-white/40 hover:text-white underline mt-4"
                    >
                        Use Password (Logout)
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
