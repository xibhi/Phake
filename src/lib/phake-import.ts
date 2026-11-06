/**
 * .phake Import Engine
 * 
 * SECURITY ARCHITECTURE NOTE (§0):
 * 1. The .phake file extension provides NO protection on its own.
 * 2. The ONE AND ONLY secrecy boundary is AES-256-GCM encryption gated by the Secret Recovery Key.
 * 3. The embedded HMAC signature is a format-identification convenience, NOT a secrecy boundary.
 * 4. Validation order (§2):
 *    - §2.1: Parse & Structural validation ("This doesn't look like a Phake backup file.")
 *    - §2.2: Verify Phake signature ("This file doesn't match Phake's backup format, or it's been modified. Import cancelled.")
 *    - §2.3: Check format version ("This backup was made with a newer version of Phake. Please update the extension.")
 *    - §2.4: Prompt for Secret Recovery Key & Decrypt ("That Secret Recovery Key doesn't match this file, or the file is corrupted.")
 */

import {
  base64ToBuffer,
  normalizeRecoveryKey,
} from './crypto';
import {
  PhakeExportEnvelope,
  PhakeExportPayload,
  PhakeImportPreview,
  VaultEntry,
  MailboxAccount,
} from './types';
import {
  CURRENT_FORMAT_VERSION,
  PHAKE_SIGNATURE_KEY,
  buildPhakeSignaturePayload,
} from './phake-export';

export interface EnvelopeValidationResult {
  success: boolean;
  error?: string;
  envelope?: PhakeExportEnvelope;
}

export interface DecryptPayloadResult {
  success: boolean;
  error?: string;
  payload?: PhakeExportPayload;
}

/**
 * Constant-time verification of HMAC-SHA256 format identification signature
 */
export async function verifyPhakeSignature(
  payloadString: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(PHAKE_SIGNATURE_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureBytes = base64ToBuffer(signatureBase64);
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      encoder.encode(payloadString)
    );
  } catch {
    return false;
  }
}

export const MAX_PHAKE_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB maximum backup file size

export function validatePhakeFileSize(sizeInBytes: number): { valid: boolean; error?: string } {
  if (typeof sizeInBytes !== 'number' || sizeInBytes <= 0) {
    return { valid: false, error: "This doesn't look like a Phake backup file." };
  }
  if (sizeInBytes > MAX_PHAKE_IMPORT_SIZE_BYTES) {
    return { valid: false, error: 'This file is too large to be a valid Phake backup.' };
  }
  return { valid: true };
}

/**
 * Step 2.1, 2.2, 2.3: Structurally validate envelope, signature, and format version
 */
export async function validatePhakeEnvelope(
  fileContent: string
): Promise<EnvelopeValidationResult> {
  // SEC-04: Size ceiling check before JSON parsing
  if (typeof fileContent !== 'string' || fileContent.length > MAX_PHAKE_IMPORT_SIZE_BYTES) {
    return {
      success: false,
      error: 'This file is too large to be a valid Phake backup.',
    };
  }

  // 2.1 Parse & structural check
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    return {
      success: false,
      error: "This doesn't look like a Phake backup file.",
    };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.phake_export !== true ||
    typeof parsed.format_version !== 'number' ||
    typeof parsed.phake_signature !== 'string' ||
    !parsed.kdf ||
    typeof parsed.kdf.salt !== 'string' ||
    typeof parsed.kdf.iterations !== 'number' ||
    !parsed.encryption ||
    typeof parsed.encryption.iv !== 'string' ||
    typeof parsed.payload !== 'string'
  ) {
    return {
      success: false,
      error: "This doesn't look like a Phake backup file.",
    };
  }

  // 2.2 Verify Phake format signature (constant-time verification)
  const sigPayload = buildPhakeSignaturePayload({
    format_version: parsed.format_version,
    kdf: {
      algorithm: parsed.kdf.algorithm || 'PBKDF2',
      hash: parsed.kdf.hash || 'SHA-256',
      iterations: parsed.kdf.iterations,
      salt: parsed.kdf.salt,
    },
    encryption: {
      algorithm: parsed.encryption.algorithm || 'AES-256-GCM',
      iv: parsed.encryption.iv,
    },
    payload: parsed.payload,
  });

  const isSigValid = await verifyPhakeSignature(sigPayload, parsed.phake_signature);
  if (!isSigValid) {
    return {
      success: false,
      error: "This file doesn't match Phake's backup format, or it's been modified. Import cancelled.",
    };
  }

  // 2.3 Check format version
  if (parsed.format_version > CURRENT_FORMAT_VERSION) {
    return {
      success: false,
      error: "This backup was made with a newer version of Phake. Please update the extension.",
    };
  }

  return {
    success: true,
    envelope: parsed as PhakeExportEnvelope,
  };
}

/**
 * Apply schema migrations for older format versions (§3)
 */
export function migratePhakePayload(payload: any, fromVersion: number): PhakeExportPayload {
  if (fromVersion === 1) {
    return {
      version: CURRENT_FORMAT_VERSION,
      vaultEntries: Array.isArray(payload.vaultEntries) ? payload.vaultEntries : [],
      mailboxes: Array.isArray(payload.mailboxes) ? payload.mailboxes : [],
      exportedAt: payload.exportedAt,
    };
  }

  // Future version migration hooks will be chained here
  return payload as PhakeExportPayload;
}

/**
 * Step 2.4: Decrypt payload using the user's Secret Recovery Key
 */
export async function decryptPhakePayload(
  envelope: PhakeExportEnvelope,
  recoveryKey: string
): Promise<DecryptPayloadResult> {
  const normalizedKey = normalizeRecoveryKey(recoveryKey);
  if (!normalizedKey || normalizedKey.length < 16) {
    return {
      success: false,
      error: 'Enter the Secret Recovery Key for this backup.',
    };
  }

  try {
    const salt = base64ToBuffer(envelope.kdf.salt);
    const iv = base64ToBuffer(envelope.encryption.iv);
    const ciphertext = base64ToBuffer(envelope.payload);

    // Derive AES-GCM key from normalized Recovery Key with file's embedded salt and iterations
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(normalizedKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: envelope.kdf.iterations,
        hash: envelope.kdf.hash || 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    const rawPayload = JSON.parse(jsonStr);

    const migrated = migratePhakePayload(rawPayload, envelope.format_version);

    return {
      success: true,
      payload: migrated,
    };
  } catch {
    return {
      success: false,
      error: "That Secret Recovery Key doesn't match this file, or the file is corrupted.",
    };
  }
}

function normalizeHostKey(host: string): string {
  return (host || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
}

/**
 * Step 2.6: Compute preview metrics and duplicate detection before committing
 */
export function calculateImportPreview(
  payload: PhakeExportPayload,
  currentVaultEntries: VaultEntry[],
  currentMailboxes: MailboxAccount[]
): PhakeImportPreview {
  const importedVault = payload.vaultEntries || [];
  const importedMailboxes = payload.mailboxes || [];

  // Vault duplicate detection: matched by site/hostname + primaryIdentifier
  const existingVaultKeys = new Set(
    currentVaultEntries.map(
      (e) => `${normalizeHostKey(e.hostname)}::${(e.primaryIdentifier || '').toLowerCase().trim()}`
    )
  );

  let duplicateVaultCount = 0;
  let newVaultCount = 0;

  importedVault.forEach((entry) => {
    const key = `${normalizeHostKey(entry.hostname)}::${(entry.primaryIdentifier || '').toLowerCase().trim()}`;
    if (existingVaultKeys.has(key)) {
      duplicateVaultCount++;
    } else {
      newVaultCount++;
    }
  });

  // Mailbox duplicate detection: matched by address
  const existingMailboxAddresses = new Set(
    currentMailboxes.map((m) => (m.address || '').toLowerCase().trim())
  );

  let duplicateMailboxCount = 0;
  let newMailboxCount = 0;

  importedMailboxes.forEach((mb) => {
    const addr = (mb.address || '').toLowerCase().trim();
    if (existingMailboxAddresses.has(addr)) {
      duplicateMailboxCount++;
    } else {
      newMailboxCount++;
    }
  });

  return {
    vaultEntriesCount: importedVault.length,
    mailboxesCount: importedMailboxes.length,
    duplicateVaultCount,
    duplicateMailboxCount,
    newVaultCount,
    newMailboxCount,
    payload,
  };
}

/**
 * Step 2.6: Merge or replace existing vault and mailbox records
 */
export function mergeOrReplaceData(
  mode: 'merge' | 'replace',
  payload: PhakeExportPayload,
  currentVaultEntries: VaultEntry[],
  currentMailboxes: MailboxAccount[]
): {
  finalVaultEntries: VaultEntry[];
  finalMailboxes: MailboxAccount[];
  addedVaultCount: number;
  addedMailboxCount: number;
} {
  const importedVault = payload.vaultEntries || [];
  const importedMailboxes = payload.mailboxes || [];

  if (mode === 'replace') {
    return {
      finalVaultEntries: importedVault,
      finalMailboxes: importedMailboxes,
      addedVaultCount: importedVault.length,
      addedMailboxCount: importedMailboxes.length,
    };
  }

  // Merge Mode (skip duplicates)
  const existingVaultKeys = new Set(
    currentVaultEntries.map(
      (e) => `${normalizeHostKey(e.hostname)}::${(e.primaryIdentifier || '').toLowerCase().trim()}`
    )
  );
  const existingVaultIds = new Set(currentVaultEntries.map((e) => e.id));

  const newVaultEntries: VaultEntry[] = [];
  importedVault.forEach((entry) => {
    const key = `${normalizeHostKey(entry.hostname)}::${(entry.primaryIdentifier || '').toLowerCase().trim()}`;
    if (!existingVaultKeys.has(key)) {
      // Ensure unique ID if imported entry has ID collision
      const uniqueId = existingVaultIds.has(entry.id)
        ? `vault_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        : entry.id;
      newVaultEntries.push({ ...entry, id: uniqueId });
    }
  });

  const finalVaultEntries = [...currentVaultEntries, ...newVaultEntries];

  // Mailbox Merge
  const existingMailboxAddresses = new Set(
    currentMailboxes.map((m) => (m.address || '').toLowerCase().trim())
  );
  const existingMailboxIds = new Set(currentMailboxes.map((m) => m.id));

  const newMailboxes: MailboxAccount[] = [];
  importedMailboxes.forEach((mb) => {
    const addr = (mb.address || '').toLowerCase().trim();
    if (!existingMailboxAddresses.has(addr)) {
      const uniqueId = existingMailboxIds.has(mb.id)
        ? `mb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        : mb.id;
      newMailboxes.push({ ...mb, id: uniqueId });
    }
  });

  const finalMailboxes = [...currentMailboxes, ...newMailboxes];

  return {
    finalVaultEntries,
    finalMailboxes,
    addedVaultCount: newVaultEntries.length,
    addedMailboxCount: newMailboxes.length,
  };
}
