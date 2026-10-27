import { describe, it, expect } from 'vitest';
import {
  encryptData,
  decryptData,
  deriveKeyFromPassword,
  generateSalt,
  generateSecretRecoveryKey,
  normalizeRecoveryKey,
  formatRecoveryKey,
  hashRecoveryKey,
  verifyRecoveryKey,
  evaluatePasswordStrength,
  generateStrongPassword,
  timingSafeEqual,
  bufferToBase64,
  base64ToBuffer,
} from './crypto';

describe('Crypto Library (src/lib/crypto.ts)', () => {
  it('1. should perform a round-trip encrypt and decrypt for arbitrary objects with password', async () => {
    const originalData = {
      user: 'alice_smith',
      email: 'alice@example.com',
      credentials: ['key1', 'key2'],
      nested: { value: 12345, active: true },
    };
    const password = 'SuperSecretMasterPassword123!';

    const encrypted = await encryptData(originalData, password);
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('salt');
    expect(encrypted.version).toBe(1);

    const decrypted = await decryptData<typeof originalData>(encrypted, password);
    expect(decrypted).toEqual(originalData);
  });

  it('2. should fail decryption when provided with the wrong password', async () => {
    const data = { secret: 'top_secret_data' };
    const correctPassword = 'CorrectPassword999!';
    const wrongPassword = 'WrongPassword000!';

    const encrypted = await encryptData(data, correctPassword);
    await expect(decryptData(encrypted, wrongPassword)).rejects.toThrow();
  });

  it('3. PBKDF2 key derivation produces a stable key for the same password and salt', async () => {
    const password = 'ConsistentPassword123#';
    const salt = generateSalt();

    const key1 = await deriveKeyFromPassword(password, salt);
    const key2 = await deriveKeyFromPassword(password, salt);

    // Encrypt with key1, decrypt with key2
    const testPayload = { message: 'deterministic key test' };
    const encrypted = await encryptData(testPayload, key1, salt);
    const decrypted = await decryptData(encrypted, key2);

    expect(decrypted).toEqual(testPayload);
  });

  it('4. should generate, format, normalize, and verify Secret Recovery Key', async () => {
    const recoveryKey = generateSecretRecoveryKey();
    expect(recoveryKey).toMatch(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){5}$/);

    const normalized = normalizeRecoveryKey(recoveryKey);
    expect(normalized).toHaveLength(24);
    expect(normalized).not.toContain('-');

    const formatted = formatRecoveryKey(normalized);
    expect(formatted).toBe(recoveryKey);

    const salt = generateSalt();
    const hash = await hashRecoveryKey(recoveryKey, salt);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    const isValid = await verifyRecoveryKey(recoveryKey, hash, salt);
    expect(isValid).toBe(true);

    // Test with lowercase and spaces / without hyphens
    const dirtyInput = recoveryKey.toLowerCase().replace(/-/g, ' ');
    const isValidDirty = await verifyRecoveryKey(dirtyInput, hash, salt);
    expect(isValidDirty).toBe(true);

    // Test with wrong key
    const wrongKey = generateSecretRecoveryKey();
    const isWrongValid = await verifyRecoveryKey(wrongKey, hash, salt);
    expect(isWrongValid).toBe(false);
  });

  it('5. should correctly evaluate password strength and generate strong passwords', () => {
    expect(evaluatePasswordStrength('weak').score).toBe(0);
    expect(evaluatePasswordStrength('Abcdef1!').hasUppercase).toBe(true);
    expect(evaluatePasswordStrength('Abcdef1!').hasLowercase).toBe(true);
    expect(evaluatePasswordStrength('Abcdef1!').hasNumber).toBe(true);
    expect(evaluatePasswordStrength('Abcdef1!').hasSymbol).toBe(true);

    const strongPass = generateStrongPassword(20);
    expect(strongPass.length).toBe(20);
    const strength = evaluatePasswordStrength(strongPass);
    expect(strength.score).toBeGreaterThanOrEqual(3);
  });

  it('6. timingSafeEqual correctly checks buffer equality without early termination', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    const c = new Uint8Array([1, 2, 3, 5]);
    const d = new Uint8Array([1, 2, 3]);

    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
    expect(timingSafeEqual(a, d)).toBe(false);
  });
});
