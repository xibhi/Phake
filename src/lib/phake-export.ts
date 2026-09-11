/**
 * .phake Export Engine
 * 
 * SECURITY ARCHITECTURE NOTE (§0):
 * 1. The .phake file extension provides NO protection on its own; it is a filename convention only.
 * 2. The ONE AND ONLY secrecy boundary is AES-256-GCM encryption gated by the user's Secret Recovery Key.
 * 3. The embedded HMAC signature is a format-identification convenience (to quickly recognize valid Phake
 *    files before prompting for a key), NOT a secrecy or confidentiality boundary.
 */

import {
  bufferToBase64,
  generateSalt,
  normalizeRecoveryKey,
  PBKDF2_ITERATIONS,
} from './crypto';
import {
  PhakeExportEnvelope,
  PhakeExportPayload,
  VaultEntry,
  MailboxAccount,
} from './types';

export const CURRENT_FORMAT_VERSION = 1;

/**
 * Fixed bundled identification key for HMAC format verification.
 * NOTE: Used for format & integrity identification only, NOT for confidentiality.
 */
export const PHAKE_SIGNATURE_KEY = 'phake-format-v1-sig-key-ident-only';

/**
 * Build deterministic canonical string over format_version + kdf params + encryption params + ciphertext
 */
export function buildPhakeSignaturePayload(params: {
  format_version: number;
  kdf: {
    algorithm: string;
    hash: string;
    iterations: number;
    salt: string;
  };
  encryption: {
    algorithm: string;
    iv: string;
  };
  payload: string;
}): string {
  return [
    params.format_version,
    params.kdf.algorithm,
    params.kdf.hash,
    params.kdf.iterations,
    params.kdf.salt,
    params.encryption.algorithm,
    params.encryption.iv,
    params.payload,
  ].join('|');
}

/**
 * Compute HMAC-SHA256 signature for format identification
 */
export async function computePhakeSignature(payloadString: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(PHAKE_SIGNATURE_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadString)
  );
  return bufferToBase64(signatureBuffer);
}

/**
 * Encrypt and generate a self-contained .phake export envelope gated by the Secret Recovery Key
 */
export async function createPhakeExportEnvelope(
  recoveryKey: string,
  vaultEntries: VaultEntry[],
  mailboxes: MailboxAccount[]
): Promise<PhakeExportEnvelope> {
  const normalizedKey = normalizeRecoveryKey(recoveryKey);
  if (!normalizedKey || normalizedKey.length < 16) {
    throw new Error('Invalid Secret Recovery Key provided for export.');
  }

  // 1. Prepare unencrypted export payload
  const payloadData: PhakeExportPayload = {
    version: CURRENT_FORMAT_VERSION,
    vaultEntries: vaultEntries || [],
    mailboxes: (mailboxes || []).map((mb) => ({
      ...mb,
    })),
    exportedAt: new Date().toISOString(),
  };

  // 2. Generate fresh random salt (16 bytes) and IV (12 bytes)
  const salt = generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Derive AES-256-GCM key from normalized Recovery Key via PBKDF2-SHA256
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const exportKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt']
  );

  // 4. Encrypt entire payload as single AES-256-GCM operation
  const plaintext = encoder.encode(JSON.stringify(payloadData));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    exportKey,
    plaintext
  );

  const ciphertextBase64 = bufferToBase64(ciphertextBuffer);
  const saltBase64 = bufferToBase64(salt);
  const ivBase64 = bufferToBase64(iv);

  // 5. Compute HMAC-SHA256 format identification signature
  const sigPayload = buildPhakeSignaturePayload({
    format_version: CURRENT_FORMAT_VERSION,
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: saltBase64,
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      iv: ivBase64,
    },
    payload: ciphertextBase64,
  });

  const signature = await computePhakeSignature(sigPayload);

  // 6. Assemble complete envelope
  return {
    phake_export: true,
    format_version: CURRENT_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    phake_signature: signature,
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: saltBase64,
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      iv: ivBase64,
    },
    payload: ciphertextBase64,
  };
}

/**
 * Generate unique backup filename: phake-backup-YYYY-MM-DD-HHmmss-xxxx.phake
 */
export function generateBackupFilename(date: Date = new Date(), uniqueSuffix?: string): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const suffix = uniqueSuffix || Math.random().toString(36).substring(2, 6);
  return `phake-backup-${yyyy}-${mm}-${dd}-${hh}${min}${ss}-${suffix}.phake`;
}

/**
 * Trigger native browser file download of .phake file
 */
export function triggerPhakeDownload(envelope: PhakeExportEnvelope, filename?: string): void {
  const jsonStr = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || generateBackupFilename();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
