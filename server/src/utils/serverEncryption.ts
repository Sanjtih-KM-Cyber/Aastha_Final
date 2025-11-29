import crypto from 'crypto';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';

// Ensure the key is exactly 32 bytes
const getKey = (): Buffer => {
    const secret = process.env.SERVER_ENCRYPTION_KEY || 'default_insecure_fallback_key_32_bytes_needed';
    return crypto.createHash('sha256').update(secret).digest();
};

export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Format: IV:AuthTag:Ciphertext
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error("Encryption failed:", error);
        return text;
    }
};

export const decrypt = (text: string): string => {
    if (!text) return text;
    try {
        const parts = text.split(':');
        // If not in IV:AuthTag:Ciphertext format, assume it's legacy plain text
        if (parts.length !== 3) return text;
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // Fail safe: return original text if decryption fails (might be plain text)
        return text;
    }
};