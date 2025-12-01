import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Use the pre-configured api instance to ensure consistent Base URL and credentials
import api from '../services/api';
import { AuthState, User } from '../types';
import { deriveKey } from '../utils/encryptionUtils';

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
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    encryptionKey: null,
  });

  // Removed local api creation to use the imported 'api' from services/api.ts

  // ---------- CHECK AUTH ----------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/users/me');
        setState({
          user: res.data,
          isAuthenticated: true,
          isLoading: false,
          encryptionKey: state.encryptionKey
        });
      } catch {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          encryptionKey: null
        });
      }
    };
    checkAuth();
  }, []);

  // ---------- LOGIN ----------
  const login = async (identifier: string, password: string) => {
    const cleanedIdentifier = identifier.toLowerCase().trim();
    const res = await api.post('/users/login', { identifier: cleanedIdentifier, password });

    const user: User = res.data;

    let key = null;
    if (!user.hasDiarySetup) key = deriveKey(password, cleanedIdentifier);

    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
      encryptionKey: key,
    });
  };

  // ---------- REGISTER ----------
  const register = async (data: RegisterData) => {
    const res = await api.post('/users/register', data);
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

  // ---------- UNLOCK ----------
  const unlockSanctuary = async (password: string): Promise<boolean> => {
    if (!state.user) return false;

    await api.post('/users/verify-diary', { diaryPassword: password });

    const emailInput = prompt("Enter your registration email:");
    if (!emailInput) return false;

    const key = deriveKey(password, emailInput);
    setState(prev => ({ ...prev, encryptionKey: key }));
    return true;
  };

  // ---------- MANUAL KEY ----------
  const setEncryptionKeyManual = (key: string) => {
    setState(prev => ({ ...prev, encryptionKey: key }));
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

  // ---------- LOGOUT ----------
  const logout = async () => {
    try {
      await api.get('/users/logout');
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
      getUserDisplayEmail
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
