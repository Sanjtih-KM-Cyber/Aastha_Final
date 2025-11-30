const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Check auth
useEffect(() => {
  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me');
      setState(prev => ({
        ...prev,
        user: res.data,
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        user: null,
      }));
    }
  };
  checkAuth();
}, []);

const login = async (identifier: string, password: string) => {
  const cleanedIdentifier = identifier.toLowerCase().trim();
  const res = await api.post('/auth/login', {
    identifier: cleanedIdentifier,
    password,
  });

  const user: User = res.data;

  let key = null;
  if (!user.hasDiarySetup) {
    key = deriveKey(password, cleanedIdentifier);
  }

  setState({
    user,
    isAuthenticated: true,
    isLoading: false,
    encryptionKey: key,
  });
};

const register = async (data: RegisterData) => {
  const res = await api.post('/auth/register', data);

  const user: User = res.data;
  const pwdToUse = data.diaryPassword || data.password;
  const key = deriveKey(pwdToUse, data.email);

  setState({
    user,
    isAuthenticated: true,
    isLoading: false,
    encryptionKey: key,
  });
};

const unlockSanctuary = async (password: string) => {
  if (!state.user) return false;

  await api.post('/auth/verify-diary', { diaryPassword: password });

  const emailInput = prompt("Please enter your email used for registration:");
  if (!emailInput) return false;

  const key = deriveKey(password, emailInput);
  setState(prev => ({ ...prev, encryptionKey: key }));
  return true;
};

const logout = async () => {
  try {
    await api.get('/auth/logout');
  } finally {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      encryptionKey: null,
    });
  }
};
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AuthState, User } from '../types';
import { deriveKey } from '../utils/encryptionUtils';

// --- MOCK SERVER KEY DECRYPTION (FOR DISPLAY ONLY) ---
const getClientServerDecrypt = (ciphertext: string) => {
    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) return ciphertext;
        return "[Encrypted Profile Data]";
    } catch (e) {
        return "[Error Decrypting]";
    }
};

interface RegisterData {
  name: string;
  email: string;
  password: string;
  diaryPassword?: string;
  securityQuestions: { question: string, answer: string }[];
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  unlockSanctuary: (password: string) => Promise<boolean>;
  setEncryptionKeyManual: (key: string) => void;
  getUserDisplayName: () => string;
  getUserDisplayEmail: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // ---------- STATE ----------
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    encryptionKey: null,
  });

  // ---------- API CLIENT ----------
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,   // ⚠️ FIXED
    withCredentials: true,
  });

  // ---------- CHECK AUTH ON LOAD ----------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');   // ⚠️ FIXED
        setState(prev => ({
          ...prev,
          user: res.data,
          isAuthenticated: true,
          isLoading: false,
        }));
      } catch {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          user: null,
        }));
      }
    };
    checkAuth();
  }, []);

  // ---------- LOGIN ----------
  const login = async (identifier: string, password: string) => {
    try {
      const cleanedIdentifier = identifier.toLowerCase().trim();

      const res = await api.post('/auth/login', {   // ⚠️ FIXED
        identifier: cleanedIdentifier,
        password,
      });

      const user: User = res.data;

      let key = null;
      if (!user.hasDiarySetup) {
        key = deriveKey(password, cleanedIdentifier);
      }

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        encryptionKey: key,
      });

    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  // ---------- REGISTER ----------
  const register = async (data: RegisterData) => {
    try {
      const res = await api.post('/auth/register', data);   // ⚠️ FIXED

      const user: User = res.data;

      const pwdToUse = data.diaryPassword || data.password;
      const key = deriveKey(pwdToUse, data.email);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        encryptionKey: key,
      });
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  // ---------- UNLOCK SANCTUARY ----------
  const unlockSanctuary = async (password: string): Promise<boolean> => {
    if (!state.user) return false;

    try {
      await api.post('/auth/verify-diary', { diaryPassword: password });   // ⚠️ FIXED

      const emailInput = prompt("To derive your diary key, re-enter your registration email:");
      if (!emailInput) return false;

      const key = deriveKey(password, emailInput);

      setState(prev => ({ ...prev, encryptionKey: key }));
      return true;

    } catch (error) {
      console.error("Unlock failed", error);
      return false;
    }
  };

  // ---------- MANUAL SET KEY ----------
  const setEncryptionKeyManual = (key: string) => {
    setState(prev => ({ ...prev, encryptionKey: key }));
  };

  // ---------- DISPLAY HELPERS ----------
  const getUserDisplayName = useCallback((): string => {
    if (!state.user) return 'Guest';
    return getClientServerDecrypt(state.user.nameEncrypted);
  }, [state.user]);

  const getUserDisplayEmail = useCallback((): string => {
    if (!state.user) return 'N/A';
    return getClientServerDecrypt(state.user.emailEncrypted);
  }, [state.user]);

  // ---------- LOGOUT ----------
  const logout = async () => {
    try {
      await api.get('/auth/logout');   // ⚠️ FIXED
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        encryptionKey: null,
      });
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
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
