import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives a 32-byte key from the provided string.
 * If the input is base64-encoded and decodes to 32 bytes, use it directly.
 * Otherwise, pad/truncate to 32 bytes using SHA-256.
 */
function deriveKey(key: string): Buffer {
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length === KEY_LENGTH) {
    return decoded;
  }
  // Use SHA-256 to normalize key to exactly 32 bytes
  return createHash('sha256').update(key).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string in the format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = deriveKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a string encrypted by encrypt().
 * Expects format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function decrypt(encryptedString: string, key: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted string format. Expected iv:authTag:ciphertext'
    );
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const keyBuffer = deriveKey(key);
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Masks a secret string, showing only the last N characters.
 * Example: maskSecret("sk-abc123def456", 4) → "**********f456"
 */
export function maskSecret(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  const masked = '*'.repeat(value.length - visibleChars);
  return masked + value.slice(-visibleChars);
}
