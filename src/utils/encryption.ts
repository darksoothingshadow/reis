import CryptoJS from 'crypto-js';

/**
 * Security utility for encrypting/decrypting sensitive data in browser storage
 * Uses AES encryption with a key derived from browser fingerprint
 */

// Derive a consistent encryption key from browser characteristics
async function deriveEncryptionKey(): Promise<string> {
    // Use extension ID + user agent as base for key derivation
    // This ensures the key is consistent per browser but different across browsers
    const extensionId = chrome.runtime?.id || 'default-extension-id';
    const userAgent = navigator.userAgent;
    const baseString = `${extensionId}-${userAgent}`;

    // Hash it to create a consistent key
    return CryptoJS.SHA256(baseString).toString();
}

let cachedKey: string | null = null;

async function getKey(): Promise<string> {
    if (!cachedKey) {
        cachedKey = await deriveEncryptionKey();
    }
    return cachedKey;
}

/**
 * Encrypt sensitive data before storing
 */
export async function encryptData(plaintext: string): Promise<string> {
    try {
        const key = await getKey();
        const encrypted = CryptoJS.AES.encrypt(plaintext, key);
        return encrypted.toString();
    } catch (error) {
        console.error('Encryption failed:', error);
        // Fallback: return plaintext if encryption fails (better than data loss)
        return plaintext;
    }
}

/**
 * Decrypt data retrieved from storage
 */
export async function decryptData(ciphertext: string): Promise<string> {
    try {
        const key = await getKey();
        const decrypted = CryptoJS.AES.decrypt(ciphertext, key);
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

        // If decryption returns empty string, the data might not be encrypted
        // Return original ciphertext as fallback
        return plaintext || ciphertext;
    } catch (error) {
        console.error('Decryption failed:', error);
        // Fallback: return original data
        return ciphertext;
    }
}

/**
 * Encrypt an object's sensitive fields
 */
export async function encryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
): Promise<T> {
    const encrypted = { ...obj };

    for (const field of sensitiveFields) {
        if (typeof encrypted[field] === 'string') {
            encrypted[field] = await encryptData(encrypted[field] as string) as any;
        }
    }

    return encrypted;
}

/**
 * Decrypt an object's sensitive fields
 */
export async function decryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
): Promise<T> {
    const decrypted = { ...obj };

    for (const field of sensitiveFields) {
        if (typeof decrypted[field] === 'string') {
            decrypted[field] = await decryptData(decrypted[field] as string) as any;
        }
    }

    return decrypted;
}
