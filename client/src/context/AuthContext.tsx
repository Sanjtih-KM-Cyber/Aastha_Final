import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AuthState, User } from '../types';
import { deriveKey } from '../utils/encryptionUtils'; 

// --- MOCK SERVER KEY DECRYPTION (FOR DISPLAY ONLY) ---
// Since the client cannot safely hold the server's key, this returns placeholders.
// You must rely on the server to send the decrypted name in chat, or accept the placeholder.
const getClientServerDecrypt = (ciphertext: string) => {
    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) return ciphertext;
        return "[Encrypted Profile Data]"; 
    } catch (e) {
        return "[Error Decrypting]";
    }
};

// --- Update RegisterData Type (Removed username for privacy)
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
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    encryptionKey: null,
  });

  const api = axios.create({
    baseURL: 'http://localhost:5000/api', 
    withCredentials: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/users/me');
        setState(prev => ({
          ...prev,
          user: res.data,
          isAuthenticated: true,
          isLoading: false,
        }));
      } catch (error) {
        setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            isAuthenticated: false, 
            user: null 
        }));
      }
    };
    checkAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      // FIX: Clean identifier before sending to match server-side hashing/encryption for lookup
      const cleanedIdentifier = identifier.toLowerCase().trim();

      const res = await api.post('/users/login', { identifier: cleanedIdentifier, password });
      
      const user: User = res.data;
      let key = null;
      
      // Attempt key derivation if no diary setup exists (using login identifier as salt source)
      if (!user.hasDiarySetup) {
        const keyAttempt = deriveKey(password, cleanedIdentifier); 
        key = keyAttempt;
      }

      setState({
        user: user,
        isAuthenticated: true,
        isLoading: false,
        encryptionKey: key,
      });
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await api.post('/users/register', data);
      
      const user: User = res.data;

      // Key derivation uses diaryPassword/password + the registration email input
      const pwdToUse = data.diaryPassword || data.password;
      const key = deriveKey(pwdToUse, data.email); 

      setState({
        user: user,
        isAuthenticated: true,
        isLoading: false,
        encryptionKey: key,
      });
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const unlockSanctuary = async (password: string): Promise<boolean> => {
    if (!state.user) return false;

    try {
      // 1. Verify password hash on server
      await api.post('/users/verify-diary', { diaryPassword: password });
      
      // 2. Successful verification means we can derive the key locally.
      //    We must prompt the user for the original email (salt) as it's not stored unencrypted.
      const emailInput = prompt("To derive your diary key, please re-enter the email you registered with.");

      if (!emailInput) {
          alert("Key derivation failed: Email required.");
          return false;
      }

      const key = deriveKey(password, emailInput);
      
      setState(prev => ({ ...prev, encryptionKey: key }));
      return true;
      
    } catch (error) {
      console.error("Unlock failed", error);
      return false;
    }
  };

  const setEncryptionKeyManual = (key: string) => {
    setState(prev => ({ ...prev, encryptionKey: key }));
  };
  
  // New Helpers for Display
  const getUserDisplayName = useCallback((): string => {
      if (!state.user) return 'Guest';
      return getClientServerDecrypt(state.user.nameEncrypted);
  }, [state.user]);

  const getUserDisplayEmail = useCallback((): string => {
      if (!state.user) return 'N/A';
      return getClientServerDecrypt(state.user.emailEncrypted);
  }, [state.user]);


  const logout = async () => {
    try {
      await api.post('/users/logout');
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
    <AuthContext.Provider value={{ ...state, login, register, logout, unlockSanctuary, setEncryptionKeyManual, getUserDisplayName, getUserDisplayEmail }}>
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