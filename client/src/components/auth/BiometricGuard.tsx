import React, { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { useBiometrics } from '../../hooks/useBiometrics';
import { LoadingFallback } from '../LoadingFallback';

interface BiometricGuardProps {
    children: React.ReactNode;
}

export const BiometricGuard: React.FC<BiometricGuardProps> = ({ children }) => {
    const { isEnabled, promptBiometrics, isLoading } = useBiometrics();
    const [isLocked, setIsLocked] = useState(false);
    const [hasCheckedInitial, setHasCheckedInitial] = useState(false);

    useEffect(() => {
        if (isLoading) return;

        // Initial Check (Only once per load)
        const check = async () => {
            if (isEnabled) {
               setIsLocked(true);

               // Timeout race: If biometrics plugin hangs, stop waiting but DO NOT UNLOCK automatically.
               // Fail closed (secure) so user has to tap 'Unlock' again.
               // Increased to 30s to allow ample time for user interaction.
               const timeoutPromise = new Promise<boolean>((resolve) => {
                   setTimeout(() => {
                       console.warn("Biometric prompt timed out.");
                       resolve(false);
                   }, 30000);
               });

               const success = await Promise.race([
                   promptBiometrics(),
                   timeoutPromise
               ]);

               // If success is false (failed/cancelled), keep it locked.
               // The UI will show a button to retry.
               setIsLocked(!success);
            } else {
                // If biometrics disabled in settings, ensure we are unlocked
                setIsLocked(false);
            }
            setHasCheckedInitial(true);
        };

        if (!hasCheckedInitial) {
            check();
        }

        // Listen for App Resume
        const listener = App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive && isEnabled) {
                setIsLocked(true);
                // Re-use the safe prompt logic
                try {
                    const success = await promptBiometrics();
                    setIsLocked(!success);
                } catch(e) {
                    console.error("Biometric resume error", e);
                    // Stay locked on error
                    setIsLocked(true);
                }
            }
        });

        return () => {
             listener.then(l => l.remove());
        };
    }, [isEnabled, isLoading]);

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
                        onClick={() => {
                            // Emergency bypass if they know their login
                            // This effectively logs them out so they can log in with password
                            localStorage.removeItem('userInfo');
                            window.location.href = '/login';
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
