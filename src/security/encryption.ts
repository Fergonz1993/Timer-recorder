/**
 * End-to-End Encryption Module
 *
 * Provides enterprise-grade encryption for sensitive data:
 * - AES-256-GCM for data encryption
 * - PBKDF2 for key derivation
 * - Secure key management
 * - Field-level encryption
 */

import * as crypto from 'crypto';
import { getDatabase } from '../storage/database.js';

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptionConfig {
  enabled: boolean;
  keyHash?: string; // To verify password without storing it
  encryptNotes: boolean;
  encryptProjects: boolean;
  encryptCategories: boolean;
  encryptSync: boolean;
  lastKeyRotation?: string;
}

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  salt: string; // Base64 encoded
}

// In-memory key (never persisted)
let encryptionKey: Buffer | null = null;

// Derive key from password
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

// Generate a random salt
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

// Encrypt data
export function encrypt(plaintext: string, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = generateSalt();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

// Decrypt data
export function decrypt(data: EncryptedData, key: Buffer): string {
  const iv = Buffer.from(data.iv, 'base64');
  const authTag = Buffer.from(data.authTag, 'base64');
  const encrypted = Buffer.from(data.encrypted, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// Check if string is encrypted data
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return parsed.encrypted && parsed.iv && parsed.authTag && parsed.salt;
  } catch {
    return false;
  }
}

// Encrypt a value if key is available
export function encryptValue(value: string): string {
  if (!encryptionKey || !value) {
    return value;
  }

  const encrypted = encrypt(value, encryptionKey);
  return JSON.stringify(encrypted);
}

// Decrypt a value if it's encrypted
export function decryptValue(value: string): string {
  if (!value || !encryptionKey || !isEncrypted(value)) {
    return value;
  }

  try {
    const data = JSON.parse(value) as EncryptedData;
    return decrypt(data, encryptionKey);
  } catch {
    return value; // Return as-is if decryption fails
  }
}

// Get encryption config
export function getEncryptionConfig(): EncryptionConfig {
  const db = getDatabase();
  const getVal = (key: string) => {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(`encryption_${key}`) as { value: string } | undefined;
    return row?.value;
  };

  return {
    enabled: getVal('enabled') === '1',
    keyHash: getVal('key_hash') || undefined,
    encryptNotes: getVal('encrypt_notes') !== '0',
    encryptProjects: getVal('encrypt_projects') === '1',
    encryptCategories: getVal('encrypt_categories') === '1',
    encryptSync: getVal('encrypt_sync') !== '0',
    lastKeyRotation: getVal('last_key_rotation') || undefined,
  };
}

// Save encryption config
export function saveEncryptionConfig(config: Partial<EncryptionConfig>): void {
  const db = getDatabase();
  const setVal = (key: string, value: string | undefined) => {
    if (value !== undefined) {
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(`encryption_${key}`, value);
    }
  };

  if (config.enabled !== undefined) setVal('enabled', config.enabled ? '1' : '0');
  if (config.keyHash !== undefined) setVal('key_hash', config.keyHash);
  if (config.encryptNotes !== undefined) setVal('encrypt_notes', config.encryptNotes ? '1' : '0');
  if (config.encryptProjects !== undefined) setVal('encrypt_projects', config.encryptProjects ? '1' : '0');
  if (config.encryptCategories !== undefined) setVal('encrypt_categories', config.encryptCategories ? '1' : '0');
  if (config.encryptSync !== undefined) setVal('encrypt_sync', config.encryptSync ? '1' : '0');
  if (config.lastKeyRotation !== undefined) setVal('last_key_rotation', config.lastKeyRotation);
}

// Initialize encryption with password
export function initializeEncryption(password: string): { success: boolean; error?: string } {
  const config = getEncryptionConfig();

  if (config.enabled && config.keyHash) {
    return { success: false, error: 'Encryption is already initialized. Use unlock instead.' };
  }

  // Generate salt and derive key
  const salt = generateSalt();
  const key = deriveKey(password, salt);

  // Create a hash to verify password later
  const verificationPlaintext = 'timer-record-encryption-verification';
  const encrypted = encrypt(verificationPlaintext, key);

  // Store salt with the encrypted verification
  const keyHash = JSON.stringify({
    ...encrypted,
    salt: salt.toString('base64'),
    verification: encrypted,
  });

  // Set the encryption key in memory
  encryptionKey = key;

  // Save config
  saveEncryptionConfig({
    enabled: true,
    keyHash,
    encryptNotes: true,
    encryptSync: true,
    lastKeyRotation: new Date().toISOString(),
  });

  return { success: true };
}

// Unlock encryption with password
export function unlockEncryption(password: string): { success: boolean; error?: string } {
  const config = getEncryptionConfig();

  if (!config.enabled || !config.keyHash) {
    return { success: false, error: 'Encryption is not initialized.' };
  }

  try {
    const keyData = JSON.parse(config.keyHash);
    const salt = Buffer.from(keyData.salt, 'base64');
    const key = deriveKey(password, salt);

    // Verify password by trying to decrypt the verification
    const verificationData = keyData.verification as EncryptedData;
    const decrypted = decrypt(verificationData, key);

    if (decrypted !== 'timer-record-encryption-verification') {
      return { success: false, error: 'Invalid password.' };
    }

    // Store key in memory
    encryptionKey = key;

    return { success: true };
  } catch {
    return { success: false, error: 'Invalid password or corrupted key data.' };
  }
}

// Lock encryption (clear key from memory)
export function lockEncryption(): void {
  if (encryptionKey) {
    // Overwrite key with zeros before clearing
    encryptionKey.fill(0);
    encryptionKey = null;
  }
}

// Check if encryption is unlocked
export function isEncryptionUnlocked(): boolean {
  return encryptionKey !== null;
}

// Change encryption password
export function changeEncryptionPassword(
  oldPassword: string,
  newPassword: string
): { success: boolean; error?: string } {
  // First unlock with old password
  const unlockResult = unlockEncryption(oldPassword);
  if (!unlockResult.success) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  const oldKey = encryptionKey!;
  const db = getDatabase();

  // Re-encrypt all encrypted data with new key
  const newSalt = generateSalt();
  const newKey = deriveKey(newPassword, newSalt);

  try {
    // Re-encrypt notes in time_entries
    const entries = db.prepare(`
      SELECT id, notes FROM time_entries WHERE notes IS NOT NULL
    `).all() as Array<{ id: number; notes: string }>;

    for (const entry of entries) {
      if (isEncrypted(entry.notes)) {
        const decrypted = decryptValue(entry.notes);
        const reencrypted = encrypt(decrypted, newKey);
        db.prepare(`UPDATE time_entries SET notes = ? WHERE id = ?`)
          .run(JSON.stringify(reencrypted), entry.id);
      }
    }

    // Create new verification
    const verificationPlaintext = 'timer-record-encryption-verification';
    const encrypted = encrypt(verificationPlaintext, newKey);

    const keyHash = JSON.stringify({
      salt: newSalt.toString('base64'),
      verification: encrypted,
    });

    // Update config
    saveEncryptionConfig({
      keyHash,
      lastKeyRotation: new Date().toISOString(),
    });

    // Update in-memory key
    encryptionKey = newKey;

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// Disable encryption (decrypt all data)
export function disableEncryption(password: string): { success: boolean; error?: string } {
  const unlockResult = unlockEncryption(password);
  if (!unlockResult.success) {
    return { success: false, error: 'Password is incorrect.' };
  }

  const db = getDatabase();

  try {
    // Decrypt all notes in time_entries
    const entries = db.prepare(`
      SELECT id, notes FROM time_entries WHERE notes IS NOT NULL
    `).all() as Array<{ id: number; notes: string }>;

    for (const entry of entries) {
      if (isEncrypted(entry.notes)) {
        const decrypted = decryptValue(entry.notes);
        db.prepare(`UPDATE time_entries SET notes = ? WHERE id = ?`)
          .run(decrypted, entry.id);
      }
    }

    // Clear encryption config
    saveEncryptionConfig({
      enabled: false,
      keyHash: '',
    });

    // Clear key from memory
    lockEncryption();

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// Encrypt existing data (after enabling encryption)
export function encryptExistingData(): { encrypted: number; errors: string[] } {
  if (!encryptionKey) {
    return { encrypted: 0, errors: ['Encryption is not unlocked.'] };
  }

  const db = getDatabase();
  let encrypted = 0;
  const errors: string[] = [];

  const config = getEncryptionConfig();

  // Encrypt notes
  if (config.encryptNotes) {
    const entries = db.prepare(`
      SELECT id, notes FROM time_entries
      WHERE notes IS NOT NULL AND notes != ''
    `).all() as Array<{ id: number; notes: string }>;

    for (const entry of entries) {
      if (!isEncrypted(entry.notes)) {
        try {
          const encryptedValue = encryptValue(entry.notes);
          db.prepare(`UPDATE time_entries SET notes = ? WHERE id = ?`)
            .run(encryptedValue, entry.id);
          encrypted++;
        } catch (e) {
          errors.push(`Failed to encrypt entry ${entry.id}: ${e instanceof Error ? e.message : 'Unknown'}`);
        }
      }
    }
  }

  return { encrypted, errors };
}

// Secure key generation for API keys, tokens, etc.
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Hash a value (for comparison, not encryption)
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Constant-time comparison to prevent timing attacks
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
