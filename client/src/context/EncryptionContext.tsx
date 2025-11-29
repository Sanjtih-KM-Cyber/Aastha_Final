import React, { createContext, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { encryptData, decryptData } from '../utils/encryptionUtils';

interface EncryptionContextType {
  encrypt: (text: string) => string;
  decrypt: (ciphertext: string) => string;
  isReady: boolean;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const EncryptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { encryptionKey } = useAuth();

  const encrypt = useCallback((text: string): string => {
    if (!encryptionKey) {
      console.warn("Encryption attempted without key.");
      return text; 
    }
    return encryptData(text, encryptionKey);
  }, [encryptionKey]);

  const decrypt = useCallback((ciphertext: string): string => {
    if (!encryptionKey) return "[Locked]";
    return decryptData(ciphertext, encryptionKey);
  }, [encryptionKey]);

  return (
    <EncryptionContext.Provider value={{ encrypt, decrypt, isReady: !!encryptionKey }}>
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
};