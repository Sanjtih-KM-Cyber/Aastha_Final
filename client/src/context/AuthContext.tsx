import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AuthState, User } from '../types';
import { deriveKey, decryptData } from '../utils/encryptionUtils';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants';

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

  // Helper to decrypt profile fields safely
  const getClientServerDecrypt = useCallback((ciphertext: string) => {
      if (!ciphertext) return "";
      // If we have a key, try to decrypt
      if (state.encryptionKey) {
          const decrypted = decryptData(ciphertext, state.encryptionKey);
          if (decrypted && !decrypted.startsWith('[')) return decrypted;
      }
      // If no key or decryption failed, return ciphertext if it looks plain, or a placeholder
      // Assuming if it's not decryptable, it might be plain text from legacy?
      // Or just return it to let UI handle?
      // The previous error was "[Error Decrypting]" which looks ugly.
      // Let's try to be smarter.
      if (ciphertext.includes(':')) return "[Locked]"; // It's likely encrypted
      return ciphertext; // It's likely plain text
  }, [state.encryptionKey]);

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

            setState(prev => ({
                ...prev,
                user: res.data,
                isAuthenticated: true,
                isLoading: false,
                // encryptionKey is preserved or derived later?
                // If checking auth via cookie, we don't have password to derive key!
                // Unless we stored key in memory (lost on reload) or localstorage (insecure).
                // Usually the user has to re-enter password to unlock diary if key is lost.
                // But for Profile Name? It should probably be server-decrypted or plain?
                // If it is encrypted with user password, we can't show it on refresh without re-login.
                // Assuming legacy behavior handled this or it wasn't encrypted.
            }));
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
    const salt = user.encryptionSalt || user.email;

    if (!user.hasDiarySetup) key = deriveKey(password, salt);

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

    const pwdToUse = data.diaryPassword || data.password;
    const salt = user.encryptionSalt || user.email;
    const key = deriveKey(pwdToUse, salt);

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

    await api.post('/users/verify-diary', { diaryPassword: password });
    const salt = state.user.encryptionSalt || state.user.email;
    const key = deriveKey(password, salt);
    
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

  // ---------- DISPLAY HELPERS ----------
  const getUserDisplayName = useCallback(() => {
    if (!state.user) return "Guest";
    // If name is not encrypted, return it
    if (!state.user.nameEncrypted && state.user.name) return state.user.name;
    // Try decrypt
    return getClientServerDecrypt(state.user.nameEncrypted);
  }, [state.user, getClientServerDecrypt]);

  const getUserDisplayEmail = useCallback(() => {
    if (!state.user) return "N/A";
    if (!state.user.emailEncrypted && state.user.email) return state.user.email;
    return getClientServerDecrypt(state.user.emailEncrypted);
  }, [state.user, getClientServerDecrypt]);

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
      updateUser
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
