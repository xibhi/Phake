import { AppSettings, EncryptedVaultPayload, MailboxAccount, TabId, UpdateCheckInfo, VaultEntry } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  density: 'comfortable',
  defaultCountry: 'US',
  autoLockTimeoutMinutes: 5,
};

const STORAGE_KEYS = {
  SETTINGS: 'phake_settings',
  LAST_TAB: 'phake_last_tab',
  VAULT_ENCRYPTED: 'phake_vault_encrypted',
  MAILBOXES_ENCRYPTED: 'phake_mailboxes_encrypted',
  VAULT_SALT: 'phake_vault_salt',
  LAST_UNLOCKED_AT: 'phake_last_unlocked_at',
  RECOVERY_KEY_HASH: 'phake_recovery_key_hash',
  RECOVERY_KEY_SALT: 'phake_recovery_key_salt',
  RECOVERY_KEY_ENCRYPTED: 'phake_recovery_key_encrypted',
  RECOVERY_KEY_ENC_IV: 'phake_recovery_key_enc_iv',
  RECOVERY_KEY_ENC_SALT: 'phake_recovery_key_enc_salt',
  RECOVERY_CIPHERTEXT: 'phake_recovery_ciphertext',
  RECOVERY_IV: 'phake_recovery_iv',
  RECOVERY_SALT: 'phake_recovery_salt',
  SEEN_MESSAGE_IDS: 'phake_seen_message_ids',
  UPDATE_CHECK_INFO: 'phake_update_check_info',
  PENDING_VAULT_ENTRIES: 'phake_pending_vault_entries',
  PENDING_MAILBOXES: 'phake_pending_mailboxes',
};

const SESSION_KEYS = {
  VAULT_PASSWORD: 'phake_session_vault_password',
  LAST_ACTIVITY: 'phake_session_last_activity',
  PENDING_VAULT_ENTRIES: 'phake_pending_vault_entries',
  PENDING_MAILBOXES: 'phake_pending_mailboxes',
};

function isExtensionValid(): boolean {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome?.runtime?.id && chrome?.storage?.local);
  } catch {
    return false;
  }
}

function isSessionStorageValid(): boolean {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome?.runtime?.id && chrome?.storage?.session);
  } catch {
    return false;
  }
}

// In-memory fallback map for environments without chrome.storage.session
const memorySessionStore = new Map<string, any>();

// Session storage wrapper using chrome.storage.session (persists in memory across popup opens/closes, automatically wiped on browser exit)
const sessionStorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    if (isSessionStorageValid()) {
      try {
        return await new Promise<T | null>((resolve) => {
          try {
            chrome.storage.session.get([key], (result) => {
              if (chrome.runtime?.lastError) {
                resolve(null);
              } else {
                resolve(result && result[key] !== undefined ? (result[key] as T) : null);
              }
            });
          } catch {
            resolve(null);
          }
        });
      } catch {
        return null;
      }
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const item = sessionStorage.getItem(key);
        if (item !== null) {
          try {
            return JSON.parse(item) as T;
          } catch {
            return item as unknown as T;
          }
        }
      } catch {}
    }

    return memorySessionStore.has(key) ? (memorySessionStore.get(key) as T) : null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    if (isSessionStorageValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.session.set({ [key]: value }, () => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
      return;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {}
    }

    memorySessionStore.set(key, value);
  },

  async remove(key: string): Promise<void> {
    if (isSessionStorageValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.session.remove([key], () => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
      return;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
    }

    memorySessionStore.delete(key);
  },

  async clear(): Promise<void> {
    if (isSessionStorageValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.session.clear(() => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        Object.values(SESSION_KEYS).forEach((k) => {
          try {
            sessionStorage.removeItem(k);
          } catch {}
        });
      } catch {}
    }

    memorySessionStore.clear();
  },
};

// Safe storage wrapper supporting chrome.storage.local (or isolated fallback in unit test runners)
const storageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    if (isExtensionValid()) {
      try {
        return await new Promise<T | null>((resolve) => {
          try {
            chrome.storage.local.get([key], (result) => {
              if (chrome.runtime?.lastError) {
                resolve(null);
              } else {
                resolve(result && result[key] !== undefined ? (result[key] as T) : null);
              }
            });
          } catch {
            resolve(null);
          }
        });
      } catch {
        return null;
      }
    }

    // Fallback ONLY in non-extension environments (e.g. Vitest node runner)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = localStorage.getItem(key);
        if (item === null) return null;
        return JSON.parse(item) as T;
      } catch {
        return null;
      }
    }
    return null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    if (isExtensionValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.local.set({ [key]: value }, () => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
      return;
    }

    // Fallback ONLY in non-extension environments
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch {}
    }
  },

  async remove(key: string): Promise<void> {
    if (isExtensionValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.local.remove([key], () => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  },

  async clear(): Promise<void> {
    if (isExtensionValid()) {
      try {
        await new Promise<void>((resolve) => {
          try {
            chrome.storage.local.clear(() => resolve());
          } catch {
            resolve();
          }
        });
      } catch {}
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        Object.values(STORAGE_KEYS).forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
        });
      } catch {}
    }
  },
};

export const storage = {
  async getSettings(): Promise<AppSettings> {
    const saved = await storageAdapter.get<any>(STORAGE_KEYS.SETTINGS);
    if (!saved) return { ...DEFAULT_SETTINGS };
    return {
      density: saved.density || DEFAULT_SETTINGS.density,
      defaultCountry: saved.defaultCountry || DEFAULT_SETTINGS.defaultCountry,
      autoLockTimeoutMinutes:
        saved.autoLockTimeoutMinutes !== undefined
          ? saved.autoLockTimeoutMinutes
          : DEFAULT_SETTINGS.autoLockTimeoutMinutes,
    };
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      density: settings.density || current.density,
      defaultCountry: settings.defaultCountry || current.defaultCountry,
      autoLockTimeoutMinutes:
        settings.autoLockTimeoutMinutes !== undefined
          ? settings.autoLockTimeoutMinutes
          : current.autoLockTimeoutMinutes,
    };
    await storageAdapter.set(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  async getLastActiveTab(): Promise<TabId> {
    const tab = await storageAdapter.get<TabId>(STORAGE_KEYS.LAST_TAB);
    return tab || 'filler';
  },

  async setLastActiveTab(tab: TabId): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.LAST_TAB, tab);
  },

  async isVaultInitialized(): Promise<boolean> {
    const vault = await storageAdapter.get<EncryptedVaultPayload>(STORAGE_KEYS.VAULT_ENCRYPTED);
    return Boolean(vault && vault.ciphertext);
  },

  async getEncryptedVault(): Promise<EncryptedVaultPayload | null> {
    const vault = await storageAdapter.get<EncryptedVaultPayload>(STORAGE_KEYS.VAULT_ENCRYPTED);
    if (!vault) return null;

    // Ensure recovery key metadata is reliably populated from dedicated keys if needed
    const recHash = vault.recoveryKeyHash || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_HASH)) || undefined;
    const recSalt = vault.recoveryKeySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_SALT)) || undefined;
    const encRecKey = vault.encryptedRecoveryKey || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENCRYPTED)) || undefined;
    const encRecKeyIv = vault.encryptedRecoveryKeyIv || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENC_IV)) || undefined;
    const encRecKeySalt = vault.encryptedRecoveryKeySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENC_SALT)) || undefined;
    const recCipher = vault.recoveryCiphertext || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_CIPHERTEXT)) || undefined;
    const recIv = vault.recoveryIv || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_IV)) || undefined;
    const recPayloadSalt = vault.recoverySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_SALT)) || undefined;

    return {
      ...vault,
      recoveryKeyHash: recHash,
      recoveryKeySalt: recSalt,
      encryptedRecoveryKey: encRecKey,
      encryptedRecoveryKeyIv: encRecKeyIv,
      encryptedRecoveryKeySalt: encRecKeySalt,
      recoveryCiphertext: recCipher,
      recoveryIv: recIv,
      recoverySalt: recPayloadSalt,
    };
  },

  async saveEncryptedVault(payload: EncryptedVaultPayload): Promise<void> {
    const existing = await storageAdapter.get<EncryptedVaultPayload>(STORAGE_KEYS.VAULT_ENCRYPTED);

    const finalRecHash = payload.recoveryKeyHash || existing?.recoveryKeyHash || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_HASH)) || undefined;
    const finalRecSalt = payload.recoveryKeySalt || existing?.recoveryKeySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_SALT)) || undefined;
    const finalEncRecKey = payload.encryptedRecoveryKey || existing?.encryptedRecoveryKey || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENCRYPTED)) || undefined;
    const finalEncRecKeyIv = payload.encryptedRecoveryKeyIv || existing?.encryptedRecoveryKeyIv || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENC_IV)) || undefined;
    const finalEncRecKeySalt = payload.encryptedRecoveryKeySalt || existing?.encryptedRecoveryKeySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_KEY_ENC_SALT)) || undefined;
    const finalRecCipher = payload.recoveryCiphertext || existing?.recoveryCiphertext || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_CIPHERTEXT)) || undefined;
    const finalRecIv = payload.recoveryIv || existing?.recoveryIv || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_IV)) || undefined;
    const finalRecPayloadSalt = payload.recoverySalt || existing?.recoverySalt || (await storageAdapter.get<string>(STORAGE_KEYS.RECOVERY_SALT)) || undefined;

    const merged: EncryptedVaultPayload = {
      ...payload,
      recoveryKeyHash: finalRecHash,
      recoveryKeySalt: finalRecSalt,
      encryptedRecoveryKey: finalEncRecKey,
      encryptedRecoveryKeyIv: finalEncRecKeyIv,
      encryptedRecoveryKeySalt: finalEncRecKeySalt,
      recoveryCiphertext: finalRecCipher,
      recoveryIv: finalRecIv,
      recoverySalt: finalRecPayloadSalt,
    };

    await storageAdapter.set(STORAGE_KEYS.VAULT_ENCRYPTED, merged);
    await storageAdapter.set(STORAGE_KEYS.VAULT_SALT, merged.salt);

    // Also persist to dedicated backup storage keys for 100% resilience
    if (finalRecHash) await storageAdapter.set(STORAGE_KEYS.RECOVERY_KEY_HASH, finalRecHash);
    if (finalRecSalt) await storageAdapter.set(STORAGE_KEYS.RECOVERY_KEY_SALT, finalRecSalt);
    if (finalEncRecKey) await storageAdapter.set(STORAGE_KEYS.RECOVERY_KEY_ENCRYPTED, finalEncRecKey);
    if (finalEncRecKeyIv) await storageAdapter.set(STORAGE_KEYS.RECOVERY_KEY_ENC_IV, finalEncRecKeyIv);
    if (finalEncRecKeySalt) await storageAdapter.set(STORAGE_KEYS.RECOVERY_KEY_ENC_SALT, finalEncRecKeySalt);
    if (finalRecCipher) await storageAdapter.set(STORAGE_KEYS.RECOVERY_CIPHERTEXT, finalRecCipher);
    if (finalRecIv) await storageAdapter.set(STORAGE_KEYS.RECOVERY_IV, finalRecIv);
    if (finalRecPayloadSalt) await storageAdapter.set(STORAGE_KEYS.RECOVERY_SALT, finalRecPayloadSalt);
  },

  async getVaultSalt(): Promise<string | null> {
    return await storageAdapter.get<string>(STORAGE_KEYS.VAULT_SALT);
  },

  async getEncryptedMailboxes(): Promise<EncryptedVaultPayload | null> {
    return await storageAdapter.get<EncryptedVaultPayload>(STORAGE_KEYS.MAILBOXES_ENCRYPTED);
  },

  async saveEncryptedMailboxes(payload: EncryptedVaultPayload): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.MAILBOXES_ENCRYPTED, payload);
  },

  async getLastUnlockedTimestamp(): Promise<number | null> {
    return await storageAdapter.get<number>(STORAGE_KEYS.LAST_UNLOCKED_AT);
  },

  async setLastUnlockedTimestamp(ts: number): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.LAST_UNLOCKED_AT, ts);
  },

  async saveVaultSession(masterPassword: string, lastActivity: number = Date.now()): Promise<void> {
    await sessionStorageAdapter.set(SESSION_KEYS.VAULT_PASSWORD, masterPassword);
    await sessionStorageAdapter.set(SESSION_KEYS.LAST_ACTIVITY, lastActivity);
  },

  async getVaultSession(): Promise<{ password: string | null; lastActivity: number | null }> {
    const password = await sessionStorageAdapter.get<string>(SESSION_KEYS.VAULT_PASSWORD);
    const lastActivity = await sessionStorageAdapter.get<number>(SESSION_KEYS.LAST_ACTIVITY);
    return { password, lastActivity };
  },

  async updateSessionLastActivity(timestamp: number = Date.now()): Promise<void> {
    await sessionStorageAdapter.set(SESSION_KEYS.LAST_ACTIVITY, timestamp);
  },

  async clearVaultSession(): Promise<void> {
    await sessionStorageAdapter.remove(SESSION_KEYS.VAULT_PASSWORD);
    await sessionStorageAdapter.remove(SESSION_KEYS.LAST_ACTIVITY);
  },

  async clearAllData(): Promise<void> {
    await storageAdapter.clear();
    await sessionStorageAdapter.clear();
  },

  async getSeenMessageIds(): Promise<Set<string>> {
    const ids = await storageAdapter.get<string[]>(STORAGE_KEYS.SEEN_MESSAGE_IDS);
    return new Set<string>(ids || []);
  },

  async saveSeenMessageIds(ids: Set<string> | string[]): Promise<void> {
    const arr = Array.isArray(ids) ? ids : Array.from(ids);
    await storageAdapter.set(STORAGE_KEYS.SEEN_MESSAGE_IDS, arr);
  },

  async getPendingVaultEntries(): Promise<VaultEntry[]> {
    const localEntries = await storageAdapter.get<VaultEntry[]>(STORAGE_KEYS.PENDING_VAULT_ENTRIES);
    const sessionEntries = await sessionStorageAdapter.get<VaultEntry[]>(SESSION_KEYS.PENDING_VAULT_ENTRIES);
    const combined = [...(localEntries || []), ...(sessionEntries || [])];
    const unique = new Map<string, VaultEntry>();
    combined.forEach((e) => unique.set(e.id, e));
    return Array.from(unique.values());
  },

  async savePendingVaultEntries(entries: VaultEntry[]): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.PENDING_VAULT_ENTRIES, entries);
    await sessionStorageAdapter.set(SESSION_KEYS.PENDING_VAULT_ENTRIES, entries);
  },

  async clearPendingVaultEntries(): Promise<void> {
    await storageAdapter.remove(STORAGE_KEYS.PENDING_VAULT_ENTRIES);
    await sessionStorageAdapter.remove(SESSION_KEYS.PENDING_VAULT_ENTRIES);
  },

  async getPendingMailboxes(): Promise<MailboxAccount[]> {
    const localMbs = await storageAdapter.get<MailboxAccount[]>(STORAGE_KEYS.PENDING_MAILBOXES);
    const sessionMbs = await sessionStorageAdapter.get<MailboxAccount[]>(SESSION_KEYS.PENDING_MAILBOXES);
    const combined = [...(localMbs || []), ...(sessionMbs || [])];
    const unique = new Map<string, MailboxAccount>();
    combined.forEach((m) => unique.set(m.address.toLowerCase(), m));
    return Array.from(unique.values());
  },

  async savePendingMailboxes(mbs: MailboxAccount[]): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.PENDING_MAILBOXES, mbs);
    await sessionStorageAdapter.set(SESSION_KEYS.PENDING_MAILBOXES, mbs);
  },

  async clearPendingMailboxes(): Promise<void> {
    await storageAdapter.remove(STORAGE_KEYS.PENDING_MAILBOXES);
    await sessionStorageAdapter.remove(SESSION_KEYS.PENDING_MAILBOXES);
  },

  async getUpdateCheckInfo(): Promise<UpdateCheckInfo | null> {
    return await storageAdapter.get<UpdateCheckInfo>(STORAGE_KEYS.UPDATE_CHECK_INFO);
  },

  async setUpdateCheckInfo(info: UpdateCheckInfo): Promise<void> {
    await storageAdapter.set(STORAGE_KEYS.UPDATE_CHECK_INFO, info);
  },
};
