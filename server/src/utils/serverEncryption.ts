import crypto from 'crypto';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';

// Load keys: Primary (New) and Fallback (Old)
const getKeys = (): Buffer[] => {
    const keys: Buffer[] = [];

    // 1. Primary Key (New)
    if (process.env.NEW_SERVER_ENCRYPTION_KEY) {
        keys.push(crypto.createHash('sha256').update(process.env.NEW_SERVER_ENCRYPTION_KEY).digest());
    }

    // 2. Fallback Key (Old) - PREVENTS GARBLED DATA
    if (process.env.SERVER_ENCRYPTION_KEY) {
        keys.push(crypto.createHash('sha256').update(process.env.SERVER_ENCRYPTION_KEY).digest());
    }

    if (keys.length === 0) {
        throw new Error("FATAL: No Encryption Keys found (NEW_SERVER_ENCRYPTION_KEY or SERVER_ENCRYPTION_KEY).");
    }
    return keys;
};

export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        // ALWAYS encrypt with the PRIMARY (First) key
        const key = getKeys()[0];
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        // FIX: Fail Closed. Do NOT return plaintext.
        console.error("CRITICAL: Encryption Service Failed:", error);
        throw new Error("Security Violation: Encryption failed.");
    }
};

export const decrypt = (text: string): string => {
    if (!text) return text;
    const parts = text.split(':');
    if (parts.length !== 3) return text; // Legacy/Plain text

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    // Try all available keys
    const keys = getKeys();

    for (const key of keys) {
        try {
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            // If we reached here, decryption was successful!
            return decrypted;
        } catch (error) {
            continue; // Wrong key, try the next one...
        }
    }

    console.error("Decryption failed with all provided keys.");
    return text;
};
