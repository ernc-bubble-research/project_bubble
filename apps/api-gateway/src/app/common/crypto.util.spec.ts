import { encrypt, decrypt, maskSecret } from './crypto.util';
import { randomBytes } from 'crypto';

describe('CryptoUtil [P0]', () => {
  const testKey = randomBytes(32).toString('base64'); // Valid 32-byte key

  describe('encrypt/decrypt round-trip', () => {
    it('[3.1-4-UNIT-001] should encrypt and decrypt a simple string', () => {
      // Given
      const plaintext = 'my-secret-api-key';

      // When
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      // Then
      expect(decrypted).toBe(plaintext);
    });

    it('[3.1-4-UNIT-002] should encrypt and decrypt a JSON object string', () => {
      // Given
      const plaintext = JSON.stringify({
        apiKey: 'sk-abc123',
        organizationId: 'org-456',
      });

      // When
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      // Then
      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual({
        apiKey: 'sk-abc123',
        organizationId: 'org-456',
      });
    });

    it('[3.1-4-UNIT-003] should produce different ciphertexts for the same plaintext (random IV)', () => {
      // Given
      const plaintext = 'same-secret';

      // When
      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);

      // Then
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1, testKey)).toBe(plaintext);
      expect(decrypt(encrypted2, testKey)).toBe(plaintext);
    });

    it('[3.1-4-UNIT-004] should handle empty string', () => {
      // Given
      const plaintext = '';

      // When
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      // Then
      expect(decrypted).toBe('');
    });

    it('[3.1-4-UNIT-005] should handle unicode characters', () => {
      // Given
      const plaintext = 'API-Key: 日本語テスト 🔑';

      // When
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      // Then
      expect(decrypted).toBe(plaintext);
    });

    it('[3.1-4-UNIT-006] should produce output in iv:authTag:ciphertext format', () => {
      // Given
      const plaintext = 'test';

      // When
      const encrypted = encrypt(plaintext, testKey);

      // Then
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be valid base64
      parts.forEach((part) => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('[3.1-4-UNIT-007] should fail decryption with wrong key', () => {
      // Given
      const plaintext = 'secret-data';
      const wrongKey = randomBytes(32).toString('base64');

      // When
      const encrypted = encrypt(plaintext, testKey);

      // Then
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('[3.1-4-UNIT-008] should fail decryption with tampered ciphertext', () => {
      // Given
      const plaintext = 'secret-data';
      const encrypted = encrypt(plaintext, testKey);
      const parts = encrypted.split(':');
      // Tamper with the ciphertext portion
      const tamperedCiphertext = Buffer.from('tampered').toString('base64');
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      // Then
      expect(() => decrypt(tampered, testKey)).toThrow();
    });

    it('[3.1-4-UNIT-009] should reject invalid encrypted string format', () => {
      // Given
      const invalidFormats = ['no-colons', 'only:one-colon', 'a:b:c:d'];

      // Then
      invalidFormats.forEach((invalid) => {
        if (invalid.split(':').length !== 3) {
          expect(() => decrypt(invalid, testKey)).toThrow(
            'Invalid encrypted string format'
          );
        }
      });
    });

    it('[3.1-4-UNIT-010] should work with non-base64 key (hashed to 32 bytes)', () => {
      // Given
      const plaintext = 'my-secret';
      const nonBase64Key = 'a-simple-password-that-is-not-base64';

      // When
      const encrypted = encrypt(plaintext, nonBase64Key);
      const decrypted = decrypt(encrypted, nonBase64Key);

      // Then
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('maskSecret', () => {
    it('[3.1-4-UNIT-011] should mask a string showing last 4 characters by default', () => {
      // Given
      const secret = 'sk-abc123def456';

      // When
      const masked = maskSecret(secret);

      // Then
      expect(masked).toBe('***********f456');
      expect(masked.length).toBe(secret.length);
    });

    it('[3.1-4-UNIT-012] should mask with custom visible character count', () => {
      // Given
      const secret = 'my-api-key-12345'; // 16 chars

      // When
      const masked = maskSecret(secret, 6);

      // Then — last 6 chars of "my-api-key-12345" is "-12345"
      expect(masked).toBe('**********-12345');
      expect(masked.length).toBe(secret.length);
    });

    it('[3.1-4-UNIT-013] should return **** for empty string', () => {
      expect(maskSecret('')).toBe('****');
    });

    it('[3.1-4-UNIT-014] should return **** for short strings', () => {
      expect(maskSecret('ab')).toBe('****');
      expect(maskSecret('abc')).toBe('****');
      expect(maskSecret('abcd')).toBe('****');
    });

    it('[3.1-4-UNIT-015] should handle string exactly longer than visibleChars', () => {
      // Given - 5 chars with 4 visible
      const secret = 'abcde';

      // When
      const masked = maskSecret(secret);

      // Then
      expect(masked).toBe('*bcde');
    });

    it('[3.1-4-UNIT-016] should return **** for null/undefined', () => {
      expect(maskSecret(null as unknown as string)).toBe('****');
      expect(maskSecret(undefined as unknown as string)).toBe('****');
    });
  });
});
