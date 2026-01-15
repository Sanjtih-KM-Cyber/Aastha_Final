import crypto from 'crypto';

// Constants
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12; // bytes (recommended for GCM)
const TAG_LENGTH = 16; // bytes
const KEY_LENGTH = 32; // bytes
const ITERATIONS = 100000;
const DIGEST = 'sha256';

/**
 * Derives a 32-byte key from a secret (password) and salt using PBKDF2.
 */
export const deriveKey = (secret: string, salt: Buffer): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(secret, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
};

/**
 * Encrypts the master key using a secret (password/answer).
 * Generates a random salt and IV.
 * Returns format: hex(salt):hex(iv):hex(authTag):hex(ciphertext)
 */
export const encryptMasterKey = async (masterKey: Buffer, secret: string): Promise<string> => {
    try {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        const wrappingKey = await deriveKey(secret, salt);

        const cipher = crypto.createCipheriv(ALGORITHM, wrappingKey, iv);

        let encrypted = cipher.update(masterKey);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const authTag = cipher.getAuthTag();

        // Format: salt:iv:tag:ciphertext
        return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        throw new Error('Encryption failed: ' + (error as any).message);
    }
};

/**
 * Decrypts the master key blob using the secret.
 * Expects format: hex(salt):hex(iv):hex(authTag):hex(ciphertext)
 */
export const decryptMasterKey = async (blob: string, secret: string): Promise<Buffer> => {
    try {
        const parts = blob.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid blob format');
        }

        const salt = Buffer.from(parts[0], 'hex');
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const ciphertext = Buffer.from(parts[3], 'hex');

        const wrappingKey = await deriveKey(secret, salt);

        const decipher = crypto.createDecipheriv(ALGORITHM, wrappingKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed: ' + (error as any).message);
    }
};

/**
 * Generates a random 32-byte master key.
 */
export const generateMasterKey = (): Buffer => {
    return crypto.randomBytes(32);
};
