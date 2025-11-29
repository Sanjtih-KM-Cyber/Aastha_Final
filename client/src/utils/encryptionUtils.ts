import CryptoJS from 'crypto-js';

// Configuration
const SALT_ITERATIONS = 10000;
const KEY_SIZE = 256 / 32; // 256-bit key

/**
 * Derives a strong encryption key from the user's password and email (used as salt).
 * This mimics PBKDF2.
 * @param password - The user's password
 * @param email - The user's email (acts as a salt)
 * @returns The derived key as a Hex string
 */
export const deriveKey = (password: string, email: string): string => {
  const salt = email.trim().toLowerCase();
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: SALT_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
  return key.toString();
};

/**
 * Encrypts plain text using AES-256.
 * @param text - The content to encrypt
 * @param key - The derived user key
 * @returns The encrypted string (ciphertext)
 */
export const encryptData = (text: string, key: string): string => {
  if (!text) return '';
  const encrypted = CryptoJS.AES.encrypt(text, key).toString();
  return encrypted;
};

/**
 * Decrypts data using AES-256.
 * @param ciphertext - The encrypted string
 * @param key - The derived user key
 * @returns The original plain text
 */
export const decryptData = (ciphertext: string, key: string): string => {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.error("Decryption failed:", error);
    return "[Encrypted Data]";
  }
};