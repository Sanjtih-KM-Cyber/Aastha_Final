import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AuthState, User } from '../types';
import { deriveKey } from '../utils/encryptionUtils';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants';

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
      // ✅ CLEAR LOCAL STORAGE
      localStorage.removeItem('userInfo');
      localStorage.removeItem('auth_last_active'); // Clear lock timer on explicit logout

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        encryptionKey: null,
      });
    }
  }, []);

  // ---------- AUTO-LOCK SYSTEM ----------
  useEffect(() => {
      if (!state.isAuthenticated) return;

      const checkInactivity = () => {
          // CHECK IF PREVENTED
          if (preventLockIds.current.size > 0) {
              // If widgets are active, update "last active" so the timer effectively resets
              // This ensures that the moment the music stops, the timer starts counting from *now*
              // rather than from when the user last clicked the mouse 30 mins ago.
              lastActiveRef.current = Date.now();
              localStorage.setItem('auth_last_active', Date.now().toString());
              return;
          }

          const lockSetting = localStorage.getItem('settings_autoLock');
          if (!lockSetting || lockSetting === '0') return;

          const duration = parseInt(lockSetting, 10);
          const lastActiveStr = localStorage.getItem('auth_last_active');
          const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
          const now = Date.now();

          if (now - lastActive > duration) {
              console.log("Auto-Lock Triggered");
              logout();
          }
      };

      // Run immediately on mount/auth-change to catch "closed app" scenario
      checkInactivity();

      const activityInterval = setInterval(checkInactivity, 5000); // Check every 5s

      // Activity Listener
      const updateActivity = () => {
          const now = Date.now();
          // Throttle updates to once per second
          if (now - lastActiveRef.current > 1000) {
              lastActiveRef.current = now;
              localStorage.setItem('auth_last_active', now.toString());
          }
      };

      window.addEventListener('mousedown', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('touchstart', updateActivity);

      return () => {
          clearInterval(activityInterval);
          window.removeEventListener('mousedown', updateActivity);
          window.removeEventListener('keydown', updateActivity);
          window.removeEventListener('touchstart', updateActivity);
      };
  }, [state.isAuthenticated, logout]);


  // ---------- CHECK AUTH ----------
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // ✅ Pre-check: If no token in storage, don't bother waiting for timeout
        const storedInfo = localStorage.getItem('userInfo');
        
        // If not in storage, treat as logged out immediately
        if (!storedInfo) {
             throw new Error("No token");
        }
        
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

            setState({
                user: res.data,
                isAuthenticated: true,
                isLoading: false,
                encryptionKey: state.encryptionKey 
            });
        }
      } catch (error) {
        if (isMounted) {
            // ✅ Cleanup if check fails
            localStorage.removeItem('userInfo');
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false, 
                encryptionKey: null
            });
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
    localStorage.setItem('userInfo', JSON.stringify(user));
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
    localStorage.setItem('userInfo', JSON.stringify(user));
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
        
        // ✅ Sync updates to Local Storage
        if (updatedUser) {
            const currentStorage = JSON.parse(localStorage.getItem('userInfo') || '{}');
            localStorage.setItem('userInfo', JSON.stringify({ ...currentStorage, ...updatedUser }));
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
