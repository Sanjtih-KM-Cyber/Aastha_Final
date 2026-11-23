import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AuthState, User } from '../types';
import { deriveKey } from '../utils/encryptionUtils';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants';
import { chatCache } from '../services/chatCache';

const getClientServerDecrypt = (ciphertext: string) => {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    return "[Encrypted Profile Data]";
  } catch {
    return "[Error Decrypting]";
  }
};

interface RegisterData {
  name: string;
  email: string;
  username?: string;
  dateOfBirth?: string;
  acceptTerms?: boolean; // recorded with version + time on the server
  password: string;
  diaryPassword?: string;
  securityQuestions: { question: string; answer: string }[];
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<any>;
  register: (data: RegisterData) => Promise<any>;
  logout: () => Promise<void>;
  unlockSanctuary: (password: string) => Promise<boolean>;
  setEncryptionKeyManual: (key: string) => void;
  getUserDisplayName: () => string;
  getUserDisplayEmail: () => string;
  updateUser: (data: Partial<User>) => void;
  setPreventAutoLock: (id: string, prevent: boolean) => void; // New method
  isAutoLockBlocked: () => boolean; // music / focus timer running → idle lock waits
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    encryptionKey: null,
  });

  // Ref to track last activity without triggering re-renders
  const lastActiveRef = useRef<number>(Date.now());

  // Ref to track active blockers (widgets running)
  const preventLockIds = useRef<Set<string>>(new Set());

  const setPreventAutoLock = useCallback((id: string, prevent: boolean) => {
      if (prevent) {
          preventLockIds.current.add(id);
      } else {
          preventLockIds.current.delete(id);
      }
      // Debug log to verify logic if needed
      // console.log("AutoLock Blockers:", Array.from(preventLockIds.current));
  }, []);

  // ---------- GLOBAL AUTH EVENT LISTENER ----------
  useEffect(() => {
    const handleUnauthorized = () => {
      // ✅ Clear token immediately on 401
      localStorage.removeItem('userInfo');
      sessionStorage.removeItem('userInfo'); // Tab Isolation Clear
      setState(prev => ({
        ...prev,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        encryptionKey: null
      }));
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  // ---------- LOGOUT (Defined early for use in Auto-Lock) ----------
  const logout = useCallback(async () => {
    try {
      await api.get('/users/logout').catch(console.error);
    } finally {
      // ✅ CLEAR LOCAL STORAGE & SESSION STORAGE
      localStorage.removeItem('userInfo');
      sessionStorage.removeItem('userInfo'); // Tab Isolation Clear
      localStorage.removeItem('auth_last_active'); // Clear lock timer on explicit logout
      chatCache.clearAll(); // Don't leave private chat text on the device after logout
      import('../services/followUpCheckIns').then(m => m.followUpCheckIns.cancelAll()).catch(() => {}); // no check-ins for a logged-out phone

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        encryptionKey: null,
      });
    }
  }, []);

  // Auto-lock lives in components/auth/BiometricGuard.tsx now (locks the screen instead of LOGGING YOU OUT after
  // inactivity). Widgets that keep the app "busy" (music, focus timer) still pause the idle lock via setPreventAutoLock.
  const isAutoLockBlocked = useCallback(() => preventLockIds.current.size > 0, []);

  // ---------- CHECK AUTH ----------
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // ✅ Pre-check: Priority to Session Storage (Tab Isolation)
        let storedInfo = sessionStorage.getItem('userInfo');

        // If not in session, fall back to persistent storage (Restore Session)
        if (!storedInfo) {
           storedInfo = localStorage.getItem('userInfo');
           if (storedInfo) {
               // Hydrate session storage for isolation
               sessionStorage.setItem('userInfo', storedInfo);
           }
        }
        
        // If not in storage, treat as logged out immediately
        if (!storedInfo) {
             throw new Error("No token");
        }
        
        // THE FORTRESS: Retrieve local Master Key
        // The server cannot return the decrypted masterKey in /users/me (Zero Knowledge).
        // We must retrieve it from the local session storage where login/register saved it.
        let localMasterKey = null;
        try {
            const parsed = JSON.parse(storedInfo);
            if (parsed && parsed.masterKey) localMasterKey = parsed.masterKey;
        } catch(e) {}

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        const res: any = await Promise.race([
            api.get('/users/me'),
            timeoutPromise
        ]);

        if (isMounted) {
            // Update last active on successful load
            localStorage.setItem('auth_last_active', Date.now().toString());

            // Merge local keys into fresh user data
            const userWithKey = { ...res.data };
            if (localMasterKey) {
                userWithKey.masterKey = localMasterKey;
            }

            // Determine encryption key
            let activeKey = state.encryptionKey;
            if (localMasterKey) activeKey = localMasterKey;
            else {
                 // Fallback for legacy
                 const salt = userWithKey.encryptionSalt || userWithKey.email;
                 // Note: We don't have password here to derive key.
                 // If masterKey is missing and not in state, user must re-login to decrypt data.
            }

            setState({
                user: userWithKey,
                isAuthenticated: true,
                isLoading: false,
                encryptionKey: activeKey
            });
        }
      } catch (error: any) {
        if (isMounted) {
            // ONLY logout on explicit Unauthorized (401) or Forbidden (403)
            // If it's a network error (status undefined) or Server Error (5xx), STAY LOGGED IN (Offline Mode)
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                 localStorage.removeItem('userInfo');
                 sessionStorage.removeItem('userInfo');
                 setState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    encryptionKey: null
                 });
            } else {
                 console.warn("Auth Check Failed (Network/Server). Staying logged in offline.", error);

                 // Fallback: If we have a stored token, assume it's valid for now
                 let localUser = null;
                 let localKey = null;
                 try {
                     const stored = localStorage.getItem('userInfo');
                     if (stored) {
                         localUser = JSON.parse(stored);
                         localKey = localUser.masterKey;
                     }
                 } catch(e) {}

                 if (localUser) {
                      setState({
                          user: localUser,
                          isAuthenticated: true, // Allow access (Offline Mode)
                          isLoading: false,
                          encryptionKey: localKey
                      });
                 } else {
                      // No local data? Then we must logout.
                      localStorage.removeItem('userInfo');
                      sessionStorage.removeItem('userInfo');
                      setState({
                          user: null,
                          isAuthenticated: false,
                          isLoading: false,
                          encryptionKey: null
                      });
                 }
            }
        }
      }
    };

    checkAuth();

    return () => { isMounted = false; };
  }, []);

  // ---------- LOGIN ----------
  const login = async (identifier: string, password: string) => {
    const cleanedIdentifier = identifier.toLowerCase().trim();
    const res = await api.post('/users/login', { identifier: cleanedIdentifier, password });

    if (res.data.requiresVerification) {
        return res.data;
    }

    const user: User = res.data;
    
    // ✅ SAVE TOKEN & INIT TIMER
    // Save to BOTH for Persistence + Isolation
    const userStr = JSON.stringify(user);
    localStorage.setItem('userInfo', userStr);
    sessionStorage.setItem('userInfo', userStr);
    localStorage.setItem('auth_last_active', Date.now().toString());

    let key = null;
    // THE FORTRESS: Use Master Key if available
    if (user.masterKey) {
        key = user.masterKey; // Hex string from server is directly compatible with CryptoJS
    } else {
        // Legacy fallback
        const salt = user.encryptionSalt || user.email;
        if (!user.hasDiarySetup) key = deriveKey(password, salt);
    }

    // Just proved who you are with the password → the app lock skips its start-up lock (components/auth/BiometricGuard.tsx)
    try { sessionStorage.setItem('aastha_fresh_sign_in', String(Date.now())); } catch { /* ignore */ }
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      encryptionKey: key,
    });

    return user;
  };

  // ---------- REGISTER ----------
  const register = async (data: RegisterData) => {
    const res = await api.post('/users/register', data);

    if (res.data.requiresVerification) {
        return res.data;
    }

    // If API returns user object directly (auto-login), save it
    const user: User = res.data;
    
    // ✅ SAVE TOKEN & INIT TIMER
    const userStr = JSON.stringify(user);
    localStorage.setItem('userInfo', userStr);
    sessionStorage.setItem('userInfo', userStr);
    localStorage.setItem('auth_last_active', Date.now().toString());

    let key = null;
    // THE FORTRESS: Use Master Key if available
    if (user.masterKey) {
        key = user.masterKey;
    } else {
        const pwdToUse = data.diaryPassword || data.password;
        const salt = user.encryptionSalt || user.email;
        key = deriveKey(pwdToUse, salt);
    }

    // Just proved who you are with the password → the app lock skips its start-up lock (components/auth/BiometricGuard.tsx)
    try { sessionStorage.setItem('aastha_fresh_sign_in', String(Date.now())); } catch { /* ignore */ }
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      encryptionKey: key,
    });

    return user;
  };

  // ---------- UNLOCK ----------
  const unlockSanctuary = async (password: string): Promise<boolean> => {
    if (!state.user) return false;

    // Verify password with server
    const res = await api.post('/users/verify-diary', { diaryPassword: password });

    let key;
    // THE FORTRESS: If server returns key (future upgrade), use it.
    // Currently, for "Lock Screen", we usually already have the key from Login (state.user.masterKey).
    // But if we want to be safe or if key was cleared:
    if (state.user.masterKey) {
        key = state.user.masterKey;
    } else {
        // Legacy: Re-derive from password
        const salt = state.user.encryptionSalt || state.user.email;
        key = deriveKey(password, salt);
    }
    
    setState(prev => ({ ...prev, encryptionKey: key }));
    return true;
  };

  // ---------- MANUAL KEY ----------
  const setEncryptionKeyManual = (key: string) => {
    setState(prev => ({ ...prev, encryptionKey: key }));
  };

  // ---------- UPDATE USER ----------
  const updateUser = (data: Partial<User>) => {
      setState(prev => {
        const updatedUser = prev.user ? { ...prev.user, ...data } : null;
        
        // ✅ Sync updates to Local Storage & Session Storage
        if (updatedUser) {
            const currentStorage = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const newStorage = JSON.stringify({ ...currentStorage, ...updatedUser });
            localStorage.setItem('userInfo', newStorage);
            sessionStorage.setItem('userInfo', newStorage);
        }

        return { ...prev, user: updatedUser };
      });
  };

  // ---------- COMPLETE ONBOARDING ----------
  const completeOnboarding = async () => {
    try {
        await api.post('/users/complete-onboarding');
        updateUser({ isOnboardingComplete: true });
    } catch (e) {
        console.error("Failed to complete onboarding", e);
    }
  };

  // ---------- DISPLAY HELPERS ----------
  const getUserDisplayName = useCallback(() => {
    if (!state.user) return "Guest";
    return getClientServerDecrypt(state.user.nameEncrypted);
  }, [state.user]);

  const getUserDisplayEmail = useCallback(() => {
    if (!state.user) return "N/A";
    return getClientServerDecrypt(state.user.emailEncrypted);
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      unlockSanctuary,
      setEncryptionKeyManual,
      getUserDisplayName,
      getUserDisplayEmail,
      updateUser,
      setPreventAutoLock,
      isAutoLockBlocked,
      completeOnboarding
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
