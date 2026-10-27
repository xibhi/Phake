/**
 * Native Web Crypto API (crypto.subtle) wrapper for Phake
 * Handles PBKDF2 key derivation and AES-GCM (256-bit) encryption/decryption
 */

import { EncryptedVaultPayload } from './types';

export const PBKDF2_ITERATIONS = 100000;
export const KEY_LENGTH = 256;

// Helper: Uint8Array <-> Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure random salt (16 bytes)
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive an AES-GCM CryptoKey from a plaintext password and salt using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary serializable data with AES-GCM
 */
export async function encryptData<T>(
  data: T,
  passwordOrKey: string | CryptoKey,
  providedSalt?: Uint8Array
): Promise<EncryptedVaultPayload> {
  let key: CryptoKey;
  let salt: Uint8Array;

  if (typeof passwordOrKey === 'string') {
    salt = providedSalt || generateSalt();
    key = await deriveKeyFromPassword(passwordOrKey, salt);
  } else {
    key = passwordOrKey;
    salt = providedSalt || generateSalt();
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    plaintext
  );

  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuffer),
    version: 1,
    updatedAt: Date.now(),
  };
}

/**
 * Decrypt an EncryptedVaultPayload back into original data
 */
export async function decryptData<T>(
  payload: EncryptedVaultPayload,
  passwordOrKey: string | CryptoKey
): Promise<T> {
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  let key: CryptoKey;
  if (typeof passwordOrKey === 'string') {
    key = await deriveKeyFromPassword(passwordOrKey, salt);
  } else {
    key = passwordOrKey;
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  const json = decoder.decode(decryptedBuffer);
  return JSON.parse(json) as T;
}

/**
 * Strong password generator with high entropy
 */
export function generateStrongPassword(
  length: number = 16,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}
): string {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let pool = '';
  const guaranteed: string[] = [];
  const getRandomChar = (charset: string): string => {
    const randomByte = crypto.getRandomValues(new Uint8Array(1))[0];
    return charset[randomByte % charset.length];
  };

  if (includeUppercase) {
    pool += upper;
    guaranteed.push(getRandomChar(upper));
  }
  if (includeLowercase) {
    pool += lower;
    guaranteed.push(getRandomChar(lower));
  }
  if (includeNumbers) {
    pool += numbers;
    guaranteed.push(getRandomChar(numbers));
  }
  if (includeSymbols) {
    pool += symbols;
    guaranteed.push(getRandomChar(symbols));
  }

  if (pool.length === 0) {
    pool = lower + numbers;
  }

  const remainingLength = Math.max(0, length - guaranteed.length);
  const randomBytes = new Uint8Array(remainingLength);
  crypto.getRandomValues(randomBytes);

  const result: string[] = [...guaranteed];
  for (let i = 0; i < remainingLength; i++) {
    result.push(pool[randomBytes[i] % pool.length]);
  }

  // Fisher-Yates shuffle with crypto randomness
  const shuffleBytes = new Uint8Array(result.length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

export interface PasswordStrengthResult {
  score: number;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasNumber && hasSymbol) score++;

  if (password.length < 6) score = 0;

  const scoreMap: Record<number, { label: PasswordStrengthResult['label']; color: string }> = {
    0: { label: 'Very Weak', color: '#FF453A' },
    1: { label: 'Weak', color: '#FF9F0A' },
    2: { label: 'Fair', color: '#FFD60A' },
    3: { label: 'Strong', color: '#30D158' },
    4: { label: 'Excellent', color: '#0A84FF' },
  };

  const clampedScore = Math.min(4, Math.max(0, score));

  return {
    score: clampedScore,
    label: scoreMap[clampedScore].label,
    color: scoreMap[clampedScore].color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
  };
}

/**
 * Generate a 24-character cryptographically secure Secret Recovery Key formatted in 6 chunks of 4.
 * E.g. "8FK2-PW9A-7M4X-3Q8Z-2K5T-9B7C"
 */
export function generateSecretRecoveryKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const segments: string[] = [];
  for (let i = 0; i < 6; i++) {
    let seg = '';
    for (let j = 0; j < 4; j++) {
      seg += chars[randomBytes[i * 4 + j] % chars.length];
    }
    segments.push(seg);
  }
  return segments.join('-');
}

/**
 * Normalize recovery key for comparison (strips hyphens/spaces and uppercases)
 */
export function normalizeRecoveryKey(key: string): string {
  if (!key) return '';
  return key.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Format a recovery key with hyphens into groups of 4 (e.g. XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)
 */
export function formatRecoveryKey(key: string): string {
  const norm = normalizeRecoveryKey(key);
  if (!norm) return '';
  const chunks: string[] = [];
  for (let i = 0; i < norm.length; i += 4) {
    chunks.push(norm.slice(i, i + 4));
  }
  return chunks.join('-');
}

/**
 * Hash a normalized Secret Recovery Key using PBKDF2 with SHA-256 and salt
 */
export async function hashRecoveryKey(
  recoveryKey: string,
  salt: Uint8Array
): Promise<string> {
  const normalized = normalizeRecoveryKey(recoveryKey);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToBase64(new Uint8Array(derivedBits));
}

/**
 * Constant-time byte-by-byte buffer comparison to prevent timing side-channel attacks.
 * Compares every byte without early exits or branch-dependent termination.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

/**
 * Verify an input Secret Recovery Key against the stored PBKDF2 hash using constant-time comparison
 */
export async function verifyRecoveryKey(
  inputKey: string,
  storedHash: string,
  salt: Uint8Array | string
): Promise<boolean> {
  if (!inputKey || !storedHash) return false;
  try {
    const saltBuf = typeof salt === 'string' ? base64ToBuffer(salt) : salt;
    const computedHash = await hashRecoveryKey(inputKey, saltBuf);
    const computedBuf = base64ToBuffer(computedHash);
    const storedBuf = base64ToBuffer(storedHash);
    return timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}

