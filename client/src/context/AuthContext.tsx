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
    isLoading: true,
    encryptionKey: null,
  });

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

  // ---------- CHECK AUTH ----------
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // ✅ Pre-check: If no token in storage, don't bother waiting for timeout
        const storedInfo = localStorage.getItem('userInfo');
        
        // You might want to allow this to continue if you are relying on Cookies, 
        // but given your issue, let's assume if it's not in storage, we are effectively logged out.
        // However, standard pattern is to try the API call anyway (cookies might persist).
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        const res: any = await Promise.race([
            api.get('/users/me'),
            timeoutPromise
        ]);

        if (isMounted) {
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
    
    // ✅ SAVE TOKEN TO LOCAL STORAGE
    localStorage.setItem('userInfo', JSON.stringify(user));

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
    
    // ✅ SAVE TOKEN TO LOCAL STORAGE
    localStorage.setItem('userInfo', JSON.stringify(user));

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
    return getClientServerDecrypt(state.user.nameEncrypted);
  }, [state.user]);

  const getUserDisplayEmail = useCallback(() => {
    if (!state.user) return "N/A";
    return getClientServerDecrypt(state.user.emailEncrypted);
  }, [state.user]);

  // ---------- LOGOUT ----------
  const logout = async () => {
    try {
      api.get('/users/logout').catch(console.error);
    } finally {
      // ✅ CLEAR LOCAL STORAGE
      localStorage.removeItem('userInfo');
      
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
