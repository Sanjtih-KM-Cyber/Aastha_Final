import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Starts true to block UI until check completes
    encryptionKey: null,
  });

  // ---------- GLOBAL AUTH EVENT LISTENER ----------
  useEffect(() => {
    const handleUnauthorized = () => {
      // Immediate state clear without page reload
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

  // ---------- CHECK AUTH (THE FIX FOR MANUAL REFRESH) ----------
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // 1. Create a timeout promise to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        // 2. Race the API call against the timeout
        const res: any = await Promise.race([
            api.get('/users/me'),
            timeoutPromise
        ]);

        if (isMounted) {
            setState({
                user: res.data,
                isAuthenticated: true,
                isLoading: false,
                encryptionKey: state.encryptionKey // Preserve key if exists (rare on refresh)
            });
        }
      } catch (error) {
        // If 401, Timeout, or Network Error -> Just show Login Screen
        if (isMounted) {
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false, // CRITICAL: Ensure this always flips to false
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
    
    // Ensure UI is not blocked if this fails
    try {
        const res = await api.post('/users/login', { identifier: cleanedIdentifier, password });

        if (res.data.requiresVerification) {
            return res.data;
        }

        const user: User = res.data;
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
    } catch (e) {
        throw e;
    }
  };

  // ---------- REGISTER ----------
  const register = async (data: RegisterData) => {
    const res = await api.post('/users/register', data);

    if (res.data.requiresVerification) {
        return res.data;
    }

    const user: User = res.data;
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

  // ---------- UPDATE USER (INSTANT) ----------
  const updateUser = (data: Partial<User>) => {
      setState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, ...data } : null
      }));
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

  // ---------- LOGOUT (FIXED: Soft Logout) ----------
  const logout = async () => {
    try {
      // Fire and forget - don't let a slow server block the UI logout
      api.get('/users/logout').catch(console.error);
    } finally {
      // Immediate UI update
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        encryptionKey: null,
      });
      // We removed window.location.href here to prevent the "Manual Refresh" feel.
      // Your App Router should detect !isAuthenticated and redirect to /login automatically.
    }
  };

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
