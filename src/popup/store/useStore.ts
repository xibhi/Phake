import { create } from 'zustand';
import {
  AppSettings,
  DetectedField,
  EncryptedVaultPayload,
  GeneratedFieldItem,
  MailboxAccount,
  MailMessageDetail,
  MailMessageSummary,
  NavigationTarget,
  PageAnalysisResult,
  PhakeExportPayload,
  TabId,
  UpdateCheckInfo,
  VaultEntry,
} from '../../lib/types';
import {
  createPhakeExportEnvelope,
  generateBackupFilename,
  triggerPhakeDownload,
} from '../../lib/phake-export';
import { mergeOrReplaceData } from '../../lib/phake-import';
import { storage } from '../../lib/storage';
import { applyDesignTokens } from '../../lib/design-tokens';
import { checkForExtensionUpdates } from '../../lib/version-check';
import {
  createIdentityContext,
  generateFieldValues,
  getDefaultIdentityFields,
  GeneratedIdentityContext,
  provisionMailboxForIdentity,
} from '../../lib/generator';
import {
  decryptData,
  deriveKeyFromPassword,
  encryptData,
  generateSalt,
  generateSecretRecoveryKey,
  normalizeRecoveryKey,
  hashRecoveryKey,
  verifyRecoveryKey,
  bufferToBase64,
  base64ToBuffer,
} from '../../lib/crypto';
import { mailTm } from '../../lib/guerrillamail';
import { detectFormFields } from '../../content/detector';
import { executeFill as runContentFill } from '../../content/filler';

export function normalizeHost(hostname?: string): string {
  if (!hostname) return 'website.com';
  return hostname.toLowerCase().replace(/^www\./i, '').trim();
}

const KNOWN_SITES: Record<string, string> = {
  'roboform.com': 'RoboForm',
  'google.com': 'Google',
  'github.com': 'GitHub',
  'amazon.com': 'Amazon',
  'netflix.com': 'Netflix',
  'apple.com': 'Apple',
  'microsoft.com': 'Microsoft',
  'twitter.com': 'X / Twitter',
  'x.com': 'X / Twitter',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'reddit.com': 'Reddit',
  'spotify.com': 'Spotify',
  'discord.com': 'Discord',
};

export function formatSiteName(hostname: string, customName?: string): string {
  // If user provided or saved a custom name, ALWAYS prioritize it
  if (customName && customName.trim()) {
    return customName.trim();
  }

  const host = normalizeHost(hostname);
  if (KNOWN_SITES[host]) return KNOWN_SITES[host];

  if (hostname) {
    const parts = host.split('.');
    let mainName = parts[0];
    if (parts.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'edu'].includes(parts[parts.length - 2])) {
      mainName = parts[parts.length - 3] || parts[0];
    } else if (parts.length >= 2) {
      mainName = parts[parts.length - 2];
    }

    if (mainName && mainName.length > 1) {
      return mainName
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return hostname || 'Website';
}

interface AppStore {
  // Navigation
  activeTab: TabId;
  navigationParams: NavigationTarget['params'];
  pendingFillAfterAuth: boolean;
  setActiveTab: (tab: TabId) => void;
  navigateTo: (tab: TabId, params?: NavigationTarget['params']) => void;

  // Settings
  settings: AppSettings;
  initSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  // Updates
  updateInfo: UpdateCheckInfo;
  isCheckingUpdate: boolean;
  initUpdateCheck: () => Promise<void>;
  checkUpdates: (force?: boolean) => Promise<void>;

  // Filler
  selectedCountry: string;
  setSelectedCountry: (code: string) => void;
  pageAnalysis: PageAnalysisResult | null;
  isScanningPage: boolean;
  generatedFields: GeneratedFieldItem[];
  identityContext: GeneratedIdentityContext | null;
  isGenerating: boolean;
  isFilling: boolean;
  fillSuccess: boolean;
  fillError: string | null;
  scanActiveTab: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  updateFieldValue: (fieldId: string, newValue: string) => void;
  executeFill: () => Promise<boolean>;
  openCurrentTempMailbox: () => Promise<void>;

  // Vault & Security
  isVaultInitialized: boolean;
  isVaultUnlocked: boolean;
  masterPasswordSession: string | null;
  lastActivityTime: number;
  recordActivity: () => void;
  vaultEntries: VaultEntry[];
  pendingVaultEntries: VaultEntry[];
  pendingMailboxes: MailboxAccount[];
  selectedVaultEntry: VaultEntry | null;
  vaultSearchQuery: string;
  vaultError: string | null;
  setVaultSearchQuery: (q: string) => void;
  setSelectedVaultEntry: (entry: VaultEntry | null) => void;
  checkVaultStatus: () => Promise<void>;
  setupVault: (masterPassword: string, recoveryKey: string) => Promise<boolean>;
  unlockVault: (masterPassword: string) => Promise<boolean>;
  recoverVaultWithKey: (recoveryKey: string, newPassword: string) => Promise<boolean>;
  getDecryptedRecoveryKey: (masterPassword?: string) => Promise<string | null>;
  verifyMasterPassword: (password: string) => Promise<boolean>;
  verifyRecoveryKey: (key: string) => Promise<boolean>;
  lockVault: () => void;
  addOrUpdateVaultEntry: (entry: VaultEntry) => Promise<void>;
  deleteVaultEntry: (id: string) => Promise<void>;
  resetVault: () => Promise<void>;
  changeMasterPassword: (oldPass: string, newPass: string) => Promise<boolean>;
  // Portability (.phake Export & Import)
  exportPhakeBackup: (masterPassword: string) => Promise<{ success: boolean; filename?: string; error?: string }>;
  commitPhakeImport: (
    mode: 'merge' | 'replace',
    payload: PhakeExportPayload,
    targetMasterPassword?: string,
    targetRecoveryKey?: string
  ) => Promise<{ success: boolean; addedVaultCount: number; addedMailboxCount: number; error?: string }>;

  // Inbox
  mailboxes: MailboxAccount[];
  selectedMailbox: MailboxAccount | null;
  mailboxSearchQuery: string;
  messages: MailMessageSummary[];
  selectedMessage: MailMessageDetail | null;
  isLoadingMailboxes: boolean;
  isLoadingMessages: boolean;
  isLoadingMessageDetail: boolean;
  isCreatingMailbox: boolean;
  inboxError: string | null;
  setMailboxSearchQuery: (q: string) => void;
  loadMailboxes: () => Promise<void>;
  createMailbox: (nameTag?: string) => Promise<MailboxAccount | null>;
  openMailboxByAddress: (address: string, nameTag?: string, hostname?: string) => Promise<void>;
  deleteMailbox: (id: string) => Promise<void>;
  selectMailbox: (mailbox: MailboxAccount | null) => Promise<void>;
  fetchMessages: (mailbox?: MailboxAccount) => Promise<void>;
  selectMessage: (msg: MailMessageSummary | null) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  clearInboxError: () => void;
}

let activeFetchMailboxId: string | null = null;
let activeDetailMessageId: string | null = null;

export const useStore = create<AppStore>((set, get) => ({
  // Navigation
  activeTab: 'filler',
  navigationParams: undefined,
  pendingFillAfterAuth: false,
  setActiveTab: (tab: TabId) => {
    get().recordActivity();
    if (tab !== 'vault') {
      set({ activeTab: tab, pendingFillAfterAuth: false });
    } else {
      set({ activeTab: tab });
    }
    storage.setLastActiveTab(tab);
  },
  navigateTo: (tab: TabId, params) => {
    get().recordActivity();
    set({ activeTab: tab, navigationParams: params });
    storage.setLastActiveTab(tab);

    if (tab === 'inbox' && params?.mailboxId) {
      const mb = get().mailboxes.find((m) => m.id === params.mailboxId);
      if (mb) {
        get().selectMailbox(mb);
      }
    } else if (tab === 'vault' && params?.vaultEntryId) {
      const entry = get().vaultEntries.find((e) => e.id === params.vaultEntryId);
      if (entry) {
        set({ selectedVaultEntry: entry });
      }
    }
  },

  // Settings
  settings: {
    density: 'comfortable',
    defaultCountry: 'US',
    autoLockTimeoutMinutes: 5,
  },
  initSettings: async () => {
    const saved = await storage.getSettings();
    const lastTab = await storage.getLastActiveTab();
    set({
      settings: saved,
      selectedCountry: saved.defaultCountry || 'US',
      activeTab: lastTab || 'filler',
      lastActivityTime: Date.now(),
    });
    applyDesignTokens(saved.density);
    await get().checkVaultStatus();
    await get().loadMailboxes();
    get().initUpdateCheck();
  },
  updateSettings: async (partial) => {
    get().recordActivity();
    const updated = await storage.saveSettings(partial);
    set({ settings: updated });
    applyDesignTokens(updated.density);
  },

  // Updates
  updateInfo: {
    status: 'idle',
    updateAvailable: false,
    lastCheckedAt: null,
    lastKnownRemoteVersion: null,
    updateUrl: 'https://github.com/xibhi/phake',
  },
  isCheckingUpdate: false,
  initUpdateCheck: async () => {
    try {
      const cached = await storage.getUpdateCheckInfo();
      if (cached) {
        set({ updateInfo: cached });
      }
      get().checkUpdates(false);
    } catch {}
  },
  checkUpdates: async (force: boolean = false) => {
    set({ isCheckingUpdate: true });
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'CHECK_FOR_UPDATES', payload: { force } },
          (response) => {
            if (response?.info) {
              set({ updateInfo: response.info, isCheckingUpdate: false });
            } else {
              set({ isCheckingUpdate: false });
            }
          }
        );
      } else {
        const currentVersion = '1.0.0';
        const info = await checkForExtensionUpdates(currentVersion, force);
        set({ updateInfo: info, isCheckingUpdate: false });
      }
    } catch {
      set({ isCheckingUpdate: false });
    }
  },

  // Filler
  selectedCountry: 'US',
  setSelectedCountry: (code: string) => {
    get().recordActivity();
    set({ selectedCountry: code });
    get().refreshIdentity();
  },
  pageAnalysis: null,
  isScanningPage: false,
  generatedFields: [],
  identityContext: null,
  isGenerating: false,
  isFilling: false,
  fillSuccess: false,
  fillError: null,

  scanActiveTab: async () => {
    get().recordActivity();
    set({ isScanningPage: true, fillError: null });

    const needsIdentityGeneration = get().generatedFields.length === 0;

    try {
      let result: PageAnalysisResult | null = null;

      // 1. If running directly in the content script / webpage (in-page overlay mode)
      const isContentScriptMode =
        typeof window !== 'undefined' &&
        !window.location.protocol.includes('chrome-extension:') &&
        typeof document !== 'undefined' &&
        Boolean(document.body);

      if (isContentScriptMode) {
        result = detectFormFields();
        if (result && result.fields) {
          set({ pageAnalysis: result, isScanningPage: false });
          if (needsIdentityGeneration) {
            await get().refreshIdentity();
          }
          return;
        }
      }

      // 2. If running inside extension popup window (chrome.tabs is available)
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          if (
            tab.url &&
            (tab.url.startsWith('chrome://') ||
              tab.url.startsWith('edge://') ||
              tab.url.startsWith('chrome-extension://') ||
              tab.url.startsWith('about:') ||
              tab.url.startsWith('view-source:'))
          ) {
            const emptyResult: PageAnalysisResult = {
              url: tab.url || '',
              hostname: 'Internal Page',
              title: tab.title || 'Browser Internal',
              fields: [],
              formCount: 0,
              timestamp: Date.now(),
            };
            set({ pageAnalysis: emptyResult, isScanningPage: false });
            if (needsIdentityGeneration) {
              await get().refreshIdentity();
            }
            return;
          }

          // Try sending message to content script
          try {
            result = await chrome.tabs.sendMessage(tab.id, {
              type: 'PAGE_ANALYSIS_REQUEST',
            });
          } catch {}

          if (result && result.fields) {
            set({ pageAnalysis: result });
            if (needsIdentityGeneration) {
              await get().refreshIdentity();
            }
            return;
          }
        }
      }
    } catch (err: any) {
      console.warn('Page scan failed', err);
    } finally {
      set({ isScanningPage: false });
    }

    if (!get().pageAnalysis) {
      set({
        pageAnalysis: {
          url: typeof window !== 'undefined' ? window.location.href : '',
          hostname: typeof window !== 'undefined' ? window.location.hostname : '',
          title: typeof document !== 'undefined' ? document.title : '',
          fields: [],
          formCount: 0,
          timestamp: Date.now(),
        },
      });
      if (needsIdentityGeneration) {
        await get().refreshIdentity();
      }
    }
  },

  refreshIdentity: async () => {
    get().recordActivity();
    const { selectedCountry, pageAnalysis } = get();
    set({ isGenerating: true });

    try {
      const context = createIdentityContext(selectedCountry);
      const fields = pageAnalysis?.fields || [];
      const generated =
        fields.length > 0
          ? generateFieldValues(fields, context)
          : getDefaultIdentityFields(context);
      
      // Update UI immediately (stops spinning icon right away)
      set({
        identityContext: context,
        generatedFields: generated,
        isGenerating: false,
      });

      // Provision real working temp mailbox asynchronously with timeout
      try {
        const mbPromise = provisionMailboxForIdentity(context);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
        const mb = await Promise.race([mbPromise, timeoutPromise]);

        if (mb && context.emailAddress) {
          const currentFields = get().generatedFields;
          const updatedGenerated = currentFields.map((f) =>
            f.type === 'email' ? { ...f, value: context.emailAddress! } : f
          );
          set({
            identityContext: { ...context },
            generatedFields: updatedGenerated,
          });
        }
      } catch (provErr) {
        console.warn('Async temp mailbox provisioning error', provErr);
      }
    } catch (e) {
      console.error('Failed to generate identity', e);
    } finally {
      set({ isGenerating: false });
    }
  },

  updateFieldValue: (fieldId: string, newValue: string) => {
    get().recordActivity();
    set((state) => {
      const updatedFields = state.generatedFields.map((f) =>
        f.id === fieldId ? { ...f, value: newValue } : f
      );

      const changedField = state.generatedFields.find((f) => f.id === fieldId);
      if (
        changedField &&
        ['first_name', 'middle_name', 'middle_initial', 'last_name'].includes(changedField.type)
      ) {
        const fname = updatedFields.find((f) => f.type === 'first_name')?.value || '';
        const mname =
          updatedFields.find(
            (f) => f.type === 'middle_name' || f.type === 'middle_initial'
          )?.value || '';
        const lname = updatedFields.find((f) => f.type === 'last_name')?.value || '';

        const nameParts = [fname, mname, lname].filter((p) => p && p.trim().length > 0);
        const combinedFullName = nameParts.join(' ');

        const finalFields = combinedFullName
          ? updatedFields.map((f) =>
              f.type === 'full_name' ? { ...f, value: combinedFullName } : f
            )
          : updatedFields;

        const updatedContext = state.identityContext
          ? {
              ...state.identityContext,
              firstName: fname || state.identityContext.firstName,
              middleInitial: mname || state.identityContext.middleInitial,
              lastName: lname || state.identityContext.lastName,
              fullName: combinedFullName || state.identityContext.fullName,
            }
          : null;

        return {
          generatedFields: finalFields,
          identityContext: updatedContext,
        };
      }

      if (changedField && changedField.type === 'full_name') {
        const updatedContext = state.identityContext
          ? {
              ...state.identityContext,
              fullName: newValue,
            }
          : null;
        return {
          generatedFields: updatedFields,
          identityContext: updatedContext,
        };
      }

      return { generatedFields: updatedFields };
    });
  },

  openCurrentTempMailbox: async () => {
    get().recordActivity();
    const { identityContext, generatedFields, mailboxes, pageAnalysis, isVaultInitialized, isVaultUnlocked, pendingMailboxes } = get();
    const targetEmail =
      generatedFields.find((f) => f.type === 'email')?.value ||
      identityContext?.emailAddress ||
      '';

    if (!targetEmail) {
      get().navigateTo('inbox');
      return;
    }

    // Gate on vault NOT created OR locked — prompt to authenticate first
    if (!isVaultInitialized || !isVaultUnlocked) {
      set({ activeTab: 'vault' });
      return;
    }

    const host = normalizeHost(pageAnalysis?.hostname);
    const allKnownMailboxes = [...mailboxes, ...pendingMailboxes];
    let targetMb =
      allKnownMailboxes.find((m) => m.address.toLowerCase() === targetEmail.toLowerCase()) ||
      identityContext?.mailboxAccount;

    if (!targetMb || !targetMb.token || targetMb.address.toLowerCase() !== targetEmail.toLowerCase()) {
      try {
        targetMb = await mailTm.createAccount(
          targetEmail,
          identityContext?.mailboxPassword || 'PhakeMail123!A'
        );
      } catch {
        targetMb = {
          id: targetMb?.id || `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          address: targetEmail,
          password: identityContext?.mailboxPassword || 'PhakeMail123!A',
          createdAt: Date.now(),
          unreadCount: 0,
        };
      }
    }

    targetMb.associatedHostname = host;
    const existing = get().mailboxes;
    const updatedMbs = [
      targetMb,
      ...existing.filter((m) => m.address.toLowerCase() !== targetMb!.address.toLowerCase()),
    ];
    set({ mailboxes: updatedMbs, selectedMailbox: targetMb, activeTab: 'inbox' });
    storage.setLastActiveTab('inbox');

    if (isVaultUnlocked && get().masterPasswordSession) {
      const enc = await encryptData(updatedMbs, get().masterPasswordSession!);
      await storage.saveEncryptedMailboxes(enc);
    } else {
      // Vault locked: store mailbox in pending buffer
      const pendingMbs = get().pendingMailboxes;
      const updatedPendingMbs = [
        targetMb,
        ...pendingMbs.filter((m) => m.address.toLowerCase() !== targetMb!.address.toLowerCase()),
      ];
      set({ pendingMailboxes: updatedPendingMbs });
      await storage.savePendingMailboxes(updatedPendingMbs);
    }

    await get().fetchMessages(targetMb);
  },

  executeFill: async () => {
    get().recordActivity();
    const { pageAnalysis, generatedFields, identityContext, vaultEntries, pendingVaultEntries, isVaultInitialized, isVaultUnlocked } = get();
    if (!pageAnalysis || generatedFields.length === 0) return false;

    // Build full dictionary of filled fields
    const fieldsMap: Record<string, string> = {};
    let primaryIdentifier = '';
    let passwordVal = '';

    generatedFields.forEach((f) => {
      fieldsMap[f.label] = f.value;
      if (f.type === 'email' && !primaryIdentifier) primaryIdentifier = f.value;
      if (f.type === 'username' && !primaryIdentifier) primaryIdentifier = f.value;
      if (f.type === 'full_name' && !primaryIdentifier) primaryIdentifier = f.value;
      if (f.type === 'first_name' && !primaryIdentifier) primaryIdentifier = f.value;
      if (f.type === 'password' && !passwordVal) passwordVal = f.value;
    });

    if (!primaryIdentifier && generatedFields.length > 0) {
      primaryIdentifier = generatedFields[0].value;
    }

    const host = normalizeHost(pageAnalysis.hostname);
    const siteTitle = formatSiteName(pageAnalysis.hostname, pageAnalysis.title);
    const favicon = pageAnalysis.faviconUrl || `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

    // Calculate precedence index specifically for this site (includes both saved and pending)
    const allKnownEntries = [...vaultEntries, ...pendingVaultEntries];
    const sameHostEntries = allKnownEntries.filter(
      (e) => normalizeHost(e.hostname) === host
    );
    const siteCredentialIndex = sameHostEntries.length + 1;

    // Extract the exact email value that was filled into the form or generated preview
    const filledEmail =
      generatedFields.find((f) => f.type === 'email')?.value ||
      identityContext?.emailAddress ||
      '';

    const vaultEntry: VaultEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      credentialNumber: siteCredentialIndex,
      credentialLabel: `Credential ${siteCredentialIndex}`,
      hostname: pageAnalysis.hostname || host,
      siteName: siteTitle,
      url: pageAnalysis.url || `https://${host}`,
      faviconUrl: favicon,
      primaryIdentifier: primaryIdentifier || `Credential ${siteCredentialIndex}`,
      password: passwordVal,
      fields: fieldsMap,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      isGeneratedInbox: Boolean(filledEmail),
    };

    // 1. Gate on vault NOT created OR locked — require authentication so generated data is saved to vault and inbox
    if (!isVaultInitialized || !isVaultUnlocked) {
      const filteredPending = pendingVaultEntries.filter(
        (e) => !(normalizeHost(e.hostname) === host && e.primaryIdentifier === vaultEntry.primaryIdentifier)
      );
      const updatedPending = [vaultEntry, ...filteredPending];
      set({ pendingVaultEntries: updatedPending, pendingFillAfterAuth: true, activeTab: 'vault' });
      await storage.savePendingVaultEntries(updatedPending);

      if (filledEmail) {
        let targetMb: MailboxAccount | null =
          get().mailboxes.find((m) => m.address.toLowerCase() === filledEmail.toLowerCase()) ||
          get().pendingMailboxes.find((m) => m.address.toLowerCase() === filledEmail.toLowerCase()) ||
          identityContext?.mailboxAccount ||
          null;

        if (!targetMb) {
          targetMb = {
            id: `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            address: filledEmail,
            password: identityContext?.mailboxPassword || 'PhakePass123!A',
            associatedHostname: host,
            nameTag: primaryIdentifier || identityContext?.firstName || identityContext?.fullName,
            createdAt: Date.now(),
            unreadCount: 0,
          };
        } else {
          targetMb = {
            ...targetMb,
            associatedHostname: host,
            nameTag: primaryIdentifier || identityContext?.firstName || identityContext?.fullName,
          };
        }

        const filteredPendingMbs = get().pendingMailboxes.filter(
          (m) => m.address.toLowerCase() !== filledEmail.toLowerCase()
        );
        const updatedPendingMbs = [targetMb, ...filteredPendingMbs];
        set({ pendingMailboxes: updatedPendingMbs });
        await storage.savePendingMailboxes(updatedPendingMbs);
      }

      return false;
    }

    set({ isFilling: true, fillSuccess: false, fillError: null });

    try {
      const fillRequest = {
        url: pageAnalysis.url,
        hostname: pageAnalysis.hostname,
        title: pageAnalysis.title,
        faviconUrl: pageAnalysis.faviconUrl,
        fields: generatedFields.map((f) => ({
          selector: f.selector,
          type: f.type,
          value: f.value,
        })),
      };

      let result: any = null;

      // 1. If running directly in the content script / webpage (in-page overlay mode)
      const isContentScriptMode =
        typeof window !== 'undefined' &&
        !window.location.protocol.includes('chrome-extension:') &&
        typeof document !== 'undefined' &&
        Boolean(document.body);

      if (isContentScriptMode) {
        result = runContentFill(fillRequest);
      } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        // 2. Extension popup mode: send to active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          try {
            result = await chrome.tabs.sendMessage(tab.id, {
              type: 'EXECUTE_FILL',
              payload: fillRequest,
            });
          } catch {}
        }
      }

      if (result && result.success) {
        set({ fillSuccess: true });
        setTimeout(() => {
          set({ fillSuccess: false });
        }, 2500);

        // Ensure temp-mail mailbox is created & listed in Inbox tab
        if (filledEmail) {
          let targetMb: MailboxAccount | null =
            get().mailboxes.find((m) => m.address.toLowerCase() === filledEmail.toLowerCase()) ||
            identityContext?.mailboxAccount ||
            null;

          if (!targetMb || !targetMb.token || targetMb.address.toLowerCase() !== filledEmail.toLowerCase()) {
            try {
              targetMb = await mailTm.createAccount(
                filledEmail,
                identityContext?.mailboxPassword || 'PhakePass123!A'
              );
            } catch (mbErr) {
              console.warn('Mailbox API creation fallback to local', mbErr);
              targetMb = {
                id: targetMb?.id || `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                address: filledEmail,
                password: identityContext?.mailboxPassword || 'PhakePass123!A',
                createdAt: Date.now(),
                unreadCount: 0,
              };
            }
          }

          if (targetMb) {
            targetMb.associatedHostname = host;
            targetMb.nameTag = primaryIdentifier || identityContext?.firstName || identityContext?.fullName;
            const existing = get().mailboxes;
            const updatedMbs = [
              targetMb,
              ...existing.filter((m) => m.address.toLowerCase() !== targetMb!.address.toLowerCase()),
            ];
            set({ mailboxes: updatedMbs });

            if (isVaultUnlocked && get().masterPasswordSession) {
              const enc = await encryptData(updatedMbs, get().masterPasswordSession!);
              await storage.saveEncryptedMailboxes(enc);
            } else {
              // Vault locked: store mailbox in pending buffer
              const pendingMbs = get().pendingMailboxes;
              const updatedPendingMbs = [
                targetMb,
                ...pendingMbs.filter((m) => m.address.toLowerCase() !== targetMb!.address.toLowerCase()),
              ];
              set({ pendingMailboxes: updatedPendingMbs });
              await storage.savePendingMailboxes(updatedPendingMbs);
            }
          }
        }

        // Persist entry to vault (check for deduplication with pending entry merged during setup/unlock)
        if (isVaultUnlocked && get().masterPasswordSession) {
          const currentVaultEntries = get().vaultEntries;
          const matchingEntryIndex = currentVaultEntries.findIndex(
            (e) => normalizeHost(e.hostname) === host && (e.primaryIdentifier === primaryIdentifier || (e.password && e.password === passwordVal))
          );

          let finalVaultEntries: VaultEntry[];
          if (matchingEntryIndex >= 0) {
            finalVaultEntries = currentVaultEntries.map((e, idx) =>
              idx === matchingEntryIndex
                ? { ...e, lastUsedAt: Date.now(), fields: { ...e.fields, ...fieldsMap }, password: passwordVal || e.password }
                : e
            );
          } else {
            finalVaultEntries = [vaultEntry, ...currentVaultEntries];
          }

          set({ vaultEntries: finalVaultEntries });
          get().recordActivity();

          const payload = await encryptData(finalVaultEntries, get().masterPasswordSession!);
          const existingVault = await storage.getEncryptedVault();
          if (existingVault) {
            payload.recoveryKeyHash = existingVault.recoveryKeyHash;
            payload.recoveryKeySalt = existingVault.recoveryKeySalt;
            payload.encryptedRecoveryKey = existingVault.encryptedRecoveryKey;
            payload.encryptedRecoveryKeyIv = existingVault.encryptedRecoveryKeyIv;
            payload.encryptedRecoveryKeySalt = existingVault.encryptedRecoveryKeySalt;
            payload.recoveryCiphertext = existingVault.recoveryCiphertext;
            payload.recoveryIv = existingVault.recoveryIv;
            payload.recoverySalt = existingVault.recoverySalt;
          }
          await storage.saveEncryptedVault(payload);
        } else {
          // Vault locked: store entry in pending buffer (will be merged on next unlock)
          const updatedPending = [vaultEntry, ...pendingVaultEntries.filter((e) => !(normalizeHost(e.hostname) === host && e.primaryIdentifier === vaultEntry.primaryIdentifier))];
          set({ pendingVaultEntries: updatedPending });
          await storage.savePendingVaultEntries(updatedPending);
        }

        return true;
      } else {
        set({ fillError: 'Could not fill some fields. Check page permissions.' });
      }
    } catch (err: any) {
      set({ fillError: err.message || 'Fill action failed' });
    } finally {
      set({ isFilling: false });
    }

    return false;
  },

  // Vault & Security
  isVaultInitialized: false,
  isVaultUnlocked: false,
  masterPasswordSession: null,
  lastActivityTime: Date.now(),
  recordActivity: () => {
    const now = Date.now();
    set({ lastActivityTime: now });
    storage.updateSessionLastActivity(now).catch(() => {});
  },
  vaultEntries: [],
  pendingVaultEntries: [],
  pendingMailboxes: [],
  selectedVaultEntry: null,
  vaultSearchQuery: '',
  vaultError: null,

  setVaultSearchQuery: (q: string) => {
    get().recordActivity();
    set({ vaultSearchQuery: q });
  },
  setSelectedVaultEntry: (entry: VaultEntry | null) => {
    get().recordActivity();
    set({ selectedVaultEntry: entry });
  },

  checkVaultStatus: async () => {
    const encryptedVault = await storage.getEncryptedVault();
    const isInit = Boolean(encryptedVault && encryptedVault.ciphertext);
    set({ isVaultInitialized: isInit });

    if (!isInit) {
      const pendingEntries = await storage.getPendingVaultEntries();
      const pendingMbs = await storage.getPendingMailboxes();
      set({
        isVaultInitialized: false,
        isVaultUnlocked: false,
        masterPasswordSession: null,
        vaultEntries: [],
        selectedVaultEntry: null,
        pendingVaultEntries: pendingEntries,
        pendingMailboxes: pendingMbs,
      });
      return;
    }

    // Check active session from memory or storage.session
    try {
      const inMemoryPassword = get().masterPasswordSession;
      const session = await storage.getVaultSession();
      const activePassword = inMemoryPassword || session?.password;

      if (activePassword) {
        const settings = get().settings;
        const timeoutMinutes = settings.autoLockTimeoutMinutes ?? 5;
        const lastActive = session?.lastActivity || get().lastActivityTime || Date.now();
        const elapsedMs = Date.now() - lastActive;

        // Check if session has expired:
        // If timeoutMinutes === -1: Never auto-lock while browser session is open
        // If timeoutMinutes > 0: Valid if elapsedMs < timeoutMinutes * 60 * 1000
        const isExpired = timeoutMinutes !== -1 && elapsedMs >= timeoutMinutes * 60 * 1000;

        if (!isExpired) {
          try {
            const decryptedEntries = await decryptData<VaultEntry[]>(encryptedVault!, activePassword);
            const finalEntries = decryptedEntries || [];

            set({
              isVaultInitialized: true,
              isVaultUnlocked: true,
              masterPasswordSession: activePassword,
              lastActivityTime: lastActive,
              vaultEntries: finalEntries,
            });

            if (!session?.password) {
              await storage.saveVaultSession(activePassword, lastActive);
            }
            return;
          } catch {
            await storage.clearVaultSession();
          }
        } else {
          // Session expired past auto-lock timeout
          await storage.clearVaultSession();
        }
      }
    } catch (err) {
      console.warn('Auto-session restore check', err);
      await storage.clearVaultSession();
    }

    // Otherwise, vault remains locked — load any pending entries saved while locked
    const pendingEntries = await storage.getPendingVaultEntries();
    const pendingMbs = await storage.getPendingMailboxes();
    set({
      isVaultUnlocked: false,
      masterPasswordSession: null,
      pendingVaultEntries: pendingEntries,
      pendingMailboxes: pendingMbs,
    });
  },

  setupVault: async (masterPassword: string, recoveryKey: string) => {
    get().recordActivity();
    set({ vaultError: null });
    try {
      const initialEntries: VaultEntry[] = get().vaultEntries;

      // Merge any pending entries that may have been saved while locked or uninitialized
      const pendingEntries = await storage.getPendingVaultEntries();
      const inMemoryPending = get().pendingVaultEntries;
      const allEntries = [...pendingEntries, ...inMemoryPending, ...initialEntries];
      const uniqueMap = new Map<string, VaultEntry>();
      allEntries.forEach((e) => uniqueMap.set(e.id, e));
      const finalEntries = Array.from(uniqueMap.values());

      const salt = generateSalt();
      const payload = await encryptData(finalEntries, masterPassword, salt);

      // 1. Hash normalized recovery key for verification
      const normalizedKey = normalizeRecoveryKey(recoveryKey);
      const recHashSalt = generateSalt();
      const recHash = await hashRecoveryKey(normalizedKey, recHashSalt);

      // 2. Encrypt plaintext recovery key string with Master Password for secure re-access in Settings
      const encRecKeySalt = generateSalt();
      const encRecKeyPayload = await encryptData({ recoveryKey: recoveryKey.trim() }, masterPassword, encRecKeySalt);

      // 3. Encrypt vault entries with normalized recovery key for password recovery
      const recEntriesSalt = generateSalt();
      const recEntriesPayload = await encryptData(finalEntries, normalizedKey, recEntriesSalt);

      payload.recoveryKeyHash = recHash;
      payload.recoveryKeySalt = bufferToBase64(recHashSalt);
      payload.encryptedRecoveryKey = encRecKeyPayload.ciphertext;
      payload.encryptedRecoveryKeyIv = encRecKeyPayload.iv;
      payload.encryptedRecoveryKeySalt = encRecKeyPayload.salt;
      payload.recoveryCiphertext = recEntriesPayload.ciphertext;
      payload.recoveryIv = recEntriesPayload.iv;
      payload.recoverySalt = recEntriesPayload.salt;

      await storage.saveEncryptedVault(payload);

      // Encrypt mailboxes (include pending)
      const pendingMbs = await storage.getPendingMailboxes();
      const inMemoryPendingMbs = get().pendingMailboxes;
      const allMailboxes = [...pendingMbs, ...inMemoryPendingMbs, ...get().mailboxes];
      const mbMap = new Map<string, MailboxAccount>();
      allMailboxes.forEach((m) => mbMap.set(m.address.toLowerCase(), m));
      const finalMailboxes = Array.from(mbMap.values());

      const mbPayload = await encryptData(finalMailboxes, masterPassword);
      await storage.saveEncryptedMailboxes(mbPayload);

      await storage.saveVaultSession(masterPassword, Date.now());
      await storage.clearPendingVaultEntries();
      await storage.clearPendingMailboxes();

      const shouldResumeFill = get().pendingFillAfterAuth;

      set({
        isVaultInitialized: true,
        isVaultUnlocked: true,
        masterPasswordSession: masterPassword,
        lastActivityTime: Date.now(),
        vaultEntries: finalEntries,
        mailboxes: finalMailboxes,
        pendingVaultEntries: [],
        pendingMailboxes: [],
        pendingFillAfterAuth: false,
        activeTab: shouldResumeFill ? 'filler' : get().activeTab,
      });

      if (shouldResumeFill) {
        storage.setLastActiveTab('filler');
        setTimeout(() => {
          get().executeFill();
        }, 80);
      }

      return true;
    } catch (err: any) {
      const msg = err?.message || String(err || '');
      const userMsg = /context invalidated|invalidated/i.test(msg)
        ? 'Extension was reloaded. Please refresh this webpage (F5) to continue.'
        : msg || 'Failed to setup vault';
      set({ vaultError: userMsg });
      return false;
    }
  },

  unlockVault: async (masterPassword: string) => {
    get().recordActivity();
    set({ vaultError: null });
    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (!encryptedVault || !encryptedVault.ciphertext) {
        await get().checkVaultStatus();
        return false;
      }

      const decryptedEntries = await decryptData<VaultEntry[]>(encryptedVault, masterPassword);
      const finalEntries = decryptedEntries || [];

      const encryptedMailboxes = await storage.getEncryptedMailboxes();
      let decryptedMbs: MailboxAccount[] = [];

      if (encryptedMailboxes) {
        try {
          decryptedMbs = await decryptData<MailboxAccount[]>(encryptedMailboxes, masterPassword) || [];
        } catch {}
      }

      // Merge any pending entries that were saved while vault was locked
      const pendingEntries = await storage.getPendingVaultEntries();
      const pendingMbs = await storage.getPendingMailboxes();

      const mergedEntries = [...pendingEntries, ...finalEntries];
      const mergedMbsMap = new Map<string, MailboxAccount>();
      [...pendingMbs, ...decryptedMbs, ...get().mailboxes].forEach((m) => mergedMbsMap.set(m.address.toLowerCase(), m));
      const mergedMbs = Array.from(mergedMbsMap.values());

      const mbMap = new Map<string, MailboxAccount>();
      [...mergedMbs].forEach((m) => mbMap.set(m.address, m));
      const finalMbs = Array.from(mbMap.values());

      // Re-encrypt vault with merged entries
      if (pendingEntries.length > 0) {
        const payload = await encryptData(mergedEntries, masterPassword);
        if (encryptedVault) {
          payload.recoveryKeyHash = encryptedVault.recoveryKeyHash;
          payload.recoveryKeySalt = encryptedVault.recoveryKeySalt;
          payload.encryptedRecoveryKey = encryptedVault.encryptedRecoveryKey;
          payload.encryptedRecoveryKeyIv = encryptedVault.encryptedRecoveryKeyIv;
          payload.encryptedRecoveryKeySalt = encryptedVault.encryptedRecoveryKeySalt;
          payload.recoveryCiphertext = encryptedVault.recoveryCiphertext;
          payload.recoveryIv = encryptedVault.recoveryIv;
          payload.recoverySalt = encryptedVault.recoverySalt;
        }
        await storage.saveEncryptedVault(payload);
      }

      // Re-encrypt mailboxes with merged entries
      if (pendingMbs.length > 0) {
        const mbPayload = await encryptData(finalMbs, masterPassword);
        await storage.saveEncryptedMailboxes(mbPayload);
      }

      // Clear pending buffers
      await storage.clearPendingVaultEntries();
      await storage.clearPendingMailboxes();

      await storage.saveVaultSession(masterPassword, Date.now());

      const shouldResumeFill = get().pendingFillAfterAuth;

      set({
        isVaultUnlocked: true,
        masterPasswordSession: masterPassword,
        lastActivityTime: Date.now(),
        vaultEntries: mergedEntries,
        pendingVaultEntries: [],
        pendingMailboxes: [],
        mailboxes: finalMbs,
        pendingFillAfterAuth: false,
        activeTab: shouldResumeFill ? 'filler' : get().activeTab,
      });

      if (shouldResumeFill) {
        storage.setLastActiveTab('filler');
        setTimeout(() => {
          get().executeFill();
        }, 80);
      }

      return true;
    } catch {
      set({ vaultError: 'Incorrect master password. Please try again.' });
      return false;
    }
  },

  recoverVaultWithKey: async (recoveryKey: string, newPassword: string) => {
    get().recordActivity();
    set({ vaultError: null });
    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (!encryptedVault) {
        set({ vaultError: 'No encrypted vault data found.' });
        return false;
      }

      const normalizedKey = normalizeRecoveryKey(recoveryKey);
      let isValid = false;

      if (encryptedVault.recoveryKeyHash && encryptedVault.recoveryKeySalt) {
        isValid = await verifyRecoveryKey(
          normalizedKey,
          encryptedVault.recoveryKeyHash,
          encryptedVault.recoveryKeySalt
        );
      }

      let recoveredEntries: VaultEntry[] = [];
      if (encryptedVault.recoveryCiphertext && encryptedVault.recoveryIv && encryptedVault.recoverySalt) {
        try {
          const recPayload: EncryptedVaultPayload = {
            version: 1,
            ciphertext: encryptedVault.recoveryCiphertext,
            iv: encryptedVault.recoveryIv,
            salt: encryptedVault.recoverySalt,
          };
          const decrypted = await decryptData<VaultEntry[]>(recPayload, normalizedKey);
          if (decrypted) {
            recoveredEntries = decrypted;
            isValid = true;
          }
        } catch {}
      }

      if (!isValid) {
        set({ vaultError: 'Incorrect Secret Recovery Key.' });
        return false;
      }

      const targetPassword = newPassword.trim();
      
      // Re-encrypt entries with new password
      const newPayload = await encryptData(recoveredEntries, targetPassword);
      
      // Retain existing recovery hash & ciphertext
      newPayload.recoveryKeyHash = encryptedVault.recoveryKeyHash;
      newPayload.recoveryKeySalt = encryptedVault.recoveryKeySalt;
      newPayload.recoveryCiphertext = encryptedVault.recoveryCiphertext;
      newPayload.recoveryIv = encryptedVault.recoveryIv;
      newPayload.recoverySalt = encryptedVault.recoverySalt;

      // Re-encrypt the recovery key string under the new password
      const encRecKeySalt = generateSalt();
      const encRecKeyPayload = await encryptData({ recoveryKey: recoveryKey.trim() }, targetPassword, encRecKeySalt);
      newPayload.encryptedRecoveryKey = encRecKeyPayload.ciphertext;
      newPayload.encryptedRecoveryKeyIv = encRecKeyPayload.iv;
      newPayload.encryptedRecoveryKeySalt = encRecKeyPayload.salt;

      await storage.saveEncryptedVault(newPayload);
      await storage.saveVaultSession(targetPassword, Date.now());

      const shouldResumeFill = get().pendingFillAfterAuth;

      set({
        isVaultUnlocked: true,
        masterPasswordSession: targetPassword,
        vaultEntries: recoveredEntries,
        lastActivityTime: Date.now(),
        vaultError: null,
        pendingFillAfterAuth: false,
        activeTab: shouldResumeFill ? 'filler' : get().activeTab,
      });

      if (shouldResumeFill) {
        storage.setLastActiveTab('filler');
        setTimeout(() => {
          get().executeFill();
        }, 80);
      }

      return true;
    } catch (err: any) {
      set({ vaultError: err.message || 'Recovery failed.' });
      return false;
    }
  },

  getDecryptedRecoveryKey: async (masterPassword?: string) => {
    const pass = masterPassword || get().masterPasswordSession;
    if (!pass) return null;

    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (
        !encryptedVault ||
        !encryptedVault.encryptedRecoveryKey ||
        !encryptedVault.encryptedRecoveryKeyIv ||
        !encryptedVault.encryptedRecoveryKeySalt
      ) {
        return null;
      }

      const recPayload: EncryptedVaultPayload = {
        version: 1,
        ciphertext: encryptedVault.encryptedRecoveryKey,
        iv: encryptedVault.encryptedRecoveryKeyIv,
        salt: encryptedVault.encryptedRecoveryKeySalt,
      };

      const res = await decryptData<{ recoveryKey: string }>(recPayload, pass);
      return res?.recoveryKey || null;
    } catch {
      return null;
    }
  },

  verifyMasterPassword: async (inputPassword: string) => {
    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (!encryptedVault) return true;
      await decryptData<VaultEntry[]>(encryptedVault, inputPassword);
      return true;
    } catch {
      return false;
    }
  },

  verifyRecoveryKey: async (inputKey: string) => {
    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (!encryptedVault || !encryptedVault.recoveryKeyHash || !encryptedVault.recoveryKeySalt) {
        return false;
      }
      const normalized = normalizeRecoveryKey(inputKey);
      return await verifyRecoveryKey(normalized, encryptedVault.recoveryKeyHash, encryptedVault.recoveryKeySalt);
    } catch {
      return false;
    }
  },

  lockVault: async () => {
    storage.clearVaultSession().catch(() => {});
    const pendingEntries = await storage.getPendingVaultEntries();
    const pendingMbs = await storage.getPendingMailboxes();
    set({
      isVaultUnlocked: false,
      masterPasswordSession: null,
      selectedVaultEntry: null,
      vaultError: null,
      pendingVaultEntries: pendingEntries,
      pendingMailboxes: pendingMbs,
    });
  },

  addOrUpdateVaultEntry: async (entry: VaultEntry) => {
    get().recordActivity();
    const { masterPasswordSession, vaultEntries } = get();
    const existingIndex = vaultEntries.findIndex((e) => e.id === entry.id);
    let updated: VaultEntry[];
    if (existingIndex >= 0) {
      updated = [...vaultEntries];
      updated[existingIndex] = entry;
    } else {
      updated = [entry, ...vaultEntries];
    }

    set({ vaultEntries: updated, selectedVaultEntry: entry });

    if (masterPasswordSession) {
      const payload = await encryptData(updated, masterPasswordSession);
      const existingVault = await storage.getEncryptedVault();
      if (existingVault) {
        payload.recoveryKeyHash = existingVault.recoveryKeyHash;
        payload.recoveryKeySalt = existingVault.recoveryKeySalt;
        payload.encryptedRecoveryKey = existingVault.encryptedRecoveryKey;
        payload.encryptedRecoveryKeyIv = existingVault.encryptedRecoveryKeyIv;
        payload.encryptedRecoveryKeySalt = existingVault.encryptedRecoveryKeySalt;
        payload.recoveryCiphertext = existingVault.recoveryCiphertext;
        payload.recoveryIv = existingVault.recoveryIv;
        payload.recoverySalt = existingVault.recoverySalt;
      }
      await storage.saveEncryptedVault(payload);
      await storage.saveVaultSession(masterPasswordSession, Date.now());
    }
  },

  deleteVaultEntry: async (id: string) => {
    get().recordActivity();
    const { masterPasswordSession, vaultEntries, mailboxes } = get();
    const targetEntry = vaultEntries.find((e) => e.id === id);
    const updated = vaultEntries.filter((e) => e.id !== id);
    set({
      vaultEntries: updated,
      selectedVaultEntry: get().selectedVaultEntry?.id === id ? null : get().selectedVaultEntry,
    });

    if (targetEntry) {
      const emailField = Object.entries(targetEntry.fields || {}).find(([k]) =>
        /email|mail/i.test(k)
      )?.[1] || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEntry.primaryIdentifier) ? targetEntry.primaryIdentifier : null);

      if (emailField) {
        const matchedMb = mailboxes.find(
          (m) => m.address.toLowerCase() === emailField.toLowerCase().trim()
        );
        if (matchedMb) {
          await get().deleteMailbox(matchedMb.id);
        }
      }
    }

    if (masterPasswordSession) {
      const payload = await encryptData(updated, masterPasswordSession);
      const existingVault = await storage.getEncryptedVault();
      if (existingVault) {
        payload.recoveryKeyHash = existingVault.recoveryKeyHash;
        payload.recoveryKeySalt = existingVault.recoveryKeySalt;
        payload.encryptedRecoveryKey = existingVault.encryptedRecoveryKey;
        payload.encryptedRecoveryKeyIv = existingVault.encryptedRecoveryKeyIv;
        payload.encryptedRecoveryKeySalt = existingVault.encryptedRecoveryKeySalt;
        payload.recoveryCiphertext = existingVault.recoveryCiphertext;
        payload.recoveryIv = existingVault.recoveryIv;
        payload.recoverySalt = existingVault.recoverySalt;
      }
      await storage.saveEncryptedVault(payload);
      await storage.saveVaultSession(masterPasswordSession, Date.now());
    }
  },

  resetVault: async () => {
    await storage.clearAllData();
    await storage.clearVaultSession();
    await storage.clearPendingVaultEntries();
    await storage.clearPendingMailboxes();
    set({
      isVaultInitialized: false,
      isVaultUnlocked: false,
      masterPasswordSession: null,
      vaultEntries: [],
      pendingVaultEntries: [],
      pendingMailboxes: [],
      selectedVaultEntry: null,
      mailboxes: [],
      selectedMailbox: null,
      messages: [],
      selectedMessage: null,
      vaultError: null,
    });
    await get().initSettings();
  },

  changeMasterPassword: async (oldPass: string, newPass: string) => {
    get().recordActivity();
    set({ vaultError: null });
    try {
      const encryptedVault = await storage.getEncryptedVault();
      if (!encryptedVault) return false;

      const entries = await decryptData<VaultEntry[]>(encryptedVault, oldPass);
      const newPayload = await encryptData(entries, newPass);

      // Re-encrypt the recovery key string under the new password
      if (
        encryptedVault.encryptedRecoveryKey &&
        encryptedVault.encryptedRecoveryKeyIv &&
        encryptedVault.encryptedRecoveryKeySalt
      ) {
        try {
          const recPayload: EncryptedVaultPayload = {
            version: 1,
            ciphertext: encryptedVault.encryptedRecoveryKey,
            iv: encryptedVault.encryptedRecoveryKeyIv,
            salt: encryptedVault.encryptedRecoveryKeySalt,
          };
          const decryptedKeyObj = await decryptData<{ recoveryKey: string }>(recPayload, oldPass);
          const newEncKeyPayload = await encryptData(decryptedKeyObj, newPass);
          newPayload.encryptedRecoveryKey = newEncKeyPayload.ciphertext;
          newPayload.encryptedRecoveryKeyIv = newEncKeyPayload.iv;
          newPayload.encryptedRecoveryKeySalt = newEncKeyPayload.salt;
        } catch {}
      }

      // Preserve recovery payload & hash
      newPayload.recoveryKeyHash = encryptedVault.recoveryKeyHash;
      newPayload.recoveryKeySalt = encryptedVault.recoveryKeySalt;
      newPayload.recoveryCiphertext = encryptedVault.recoveryCiphertext;
      newPayload.recoveryIv = encryptedVault.recoveryIv;
      newPayload.recoverySalt = encryptedVault.recoverySalt;

      await storage.saveEncryptedVault(newPayload);

      const encMbs = await storage.getEncryptedMailboxes();
      if (encMbs) {
        try {
          const mbs = await decryptData<MailboxAccount[]>(encMbs, oldPass);
          const newMbPayload = await encryptData(mbs, newPass);
          await storage.saveEncryptedMailboxes(newMbPayload);
        } catch {}
      }

      await storage.saveVaultSession(newPass, Date.now());

      set({ masterPasswordSession: newPass, lastActivityTime: Date.now() });
      return true;
    } catch {
      set({ vaultError: 'Current master password verification failed.' });
      return false;
    }
  },

  exportPhakeBackup: async (masterPassword: string) => {
    get().recordActivity();
    try {
      // 1. Re-authenticate master password
      const isValid = await get().verifyMasterPassword(masterPassword);
      if (!isValid) {
        return { success: false, error: 'Incorrect master password.' };
      }

      // 2. Retrieve Secret Recovery Key via existing decryption path
      const recoveryKey = await get().getDecryptedRecoveryKey(masterPassword);
      if (!recoveryKey) {
        return { success: false, error: 'Unable to retrieve Secret Recovery Key for encryption.' };
      }

      // 3. Encrypt payload and build .phake envelope
      const envelope = await createPhakeExportEnvelope(
        recoveryKey,
        get().vaultEntries,
        get().mailboxes
      );

      // 4. Trigger download as .phake file
      const filename = generateBackupFilename();
      triggerPhakeDownload(envelope, filename);

      return { success: true, filename };
    } catch (err: any) {
      return { success: false, error: err.message || 'Export failed.' };
    }
  },

  commitPhakeImport: async (mode, payload, targetMasterPassword, targetRecoveryKey) => {
    get().recordActivity();
    try {
      const isInit = get().isVaultInitialized;
      const pass = targetMasterPassword || get().masterPasswordSession;

      if (!pass) {
        return {
          success: false,
          addedVaultCount: 0,
          addedMailboxCount: 0,
          error: 'Vault must be unlocked to import.',
        };
      }

      if (!isInit) {
        // Fresh install: initialize new vault with imported payload and receiver's unique recovery key
        const newRecoveryKey = targetRecoveryKey || generateSecretRecoveryKey();
        const initialVault = payload.vaultEntries || [];
        const initialMailboxes = payload.mailboxes || [];

        const salt = generateSalt();
        const vaultEncPayload = await encryptData(initialVault, pass, salt);

        const normalizedKey = normalizeRecoveryKey(newRecoveryKey);
        const recHashSalt = generateSalt();
        const recHash = await hashRecoveryKey(normalizedKey, recHashSalt);

        const encRecKeySalt = generateSalt();
        const encRecKeyPayload = await encryptData({ recoveryKey: newRecoveryKey.trim() }, pass, encRecKeySalt);

        const recEntriesSalt = generateSalt();
        const recEntriesPayload = await encryptData(initialVault, normalizedKey, recEntriesSalt);

        vaultEncPayload.recoveryKeyHash = recHash;
        vaultEncPayload.recoveryKeySalt = bufferToBase64(recHashSalt);
        vaultEncPayload.encryptedRecoveryKey = encRecKeyPayload.ciphertext;
        vaultEncPayload.encryptedRecoveryKeyIv = encRecKeyPayload.iv;
        vaultEncPayload.encryptedRecoveryKeySalt = encRecKeyPayload.salt;
        vaultEncPayload.recoveryCiphertext = recEntriesPayload.ciphertext;
        vaultEncPayload.recoveryIv = recEntriesPayload.iv;
        vaultEncPayload.recoverySalt = recEntriesPayload.salt;

        await storage.saveEncryptedVault(vaultEncPayload);

        const mbPayload = await encryptData(initialMailboxes, pass);
        await storage.saveEncryptedMailboxes(mbPayload);

        await storage.saveVaultSession(pass, Date.now());

        set({
          isVaultInitialized: true,
          isVaultUnlocked: true,
          masterPasswordSession: pass,
          lastActivityTime: Date.now(),
          vaultEntries: initialVault,
          mailboxes: initialMailboxes,
        });

        return {
          success: true,
          addedVaultCount: initialVault.length,
          addedMailboxCount: initialMailboxes.length,
        };
      }

      // Existing Vault: Merge or Replace
      const { finalVaultEntries, finalMailboxes, addedVaultCount, addedMailboxCount } = mergeOrReplaceData(
        mode,
        payload,
        get().vaultEntries,
        get().mailboxes
      );

      // Re-encrypt under the importing device's local vault master password key
      const existingVaultPayload = await storage.getEncryptedVault();
      const newVaultPayload = await encryptData(finalVaultEntries, pass);

      // Retain existing local device's recovery metadata
      if (existingVaultPayload) {
        newVaultPayload.recoveryKeyHash = existingVaultPayload.recoveryKeyHash;
        newVaultPayload.recoveryKeySalt = existingVaultPayload.recoveryKeySalt;
        newVaultPayload.encryptedRecoveryKey = existingVaultPayload.encryptedRecoveryKey;
        newVaultPayload.encryptedRecoveryKeyIv = existingVaultPayload.encryptedRecoveryKeyIv;
        newVaultPayload.encryptedRecoveryKeySalt = existingVaultPayload.encryptedRecoveryKeySalt;

        // Re-encrypt updated entries under the local device's recovery key
        const localRecKey = await get().getDecryptedRecoveryKey(pass);
        if (localRecKey) {
          const normLocalRecKey = normalizeRecoveryKey(localRecKey);
          const recEntriesPayload = await encryptData(finalVaultEntries, normLocalRecKey);
          newVaultPayload.recoveryCiphertext = recEntriesPayload.ciphertext;
          newVaultPayload.recoveryIv = recEntriesPayload.iv;
          newVaultPayload.recoverySalt = recEntriesPayload.salt;
        } else {
          newVaultPayload.recoveryCiphertext = existingVaultPayload.recoveryCiphertext;
          newVaultPayload.recoveryIv = existingVaultPayload.recoveryIv;
          newVaultPayload.recoverySalt = existingVaultPayload.recoverySalt;
        }
      }

      await storage.saveEncryptedVault(newVaultPayload);

      // Re-encrypt mailboxes
      const newMbPayload = await encryptData(finalMailboxes, pass);
      await storage.saveEncryptedMailboxes(newMbPayload);

      // §2.8: Verify correctness post-import by re-reading state
      const reReadVault = await storage.getEncryptedVault();
      const verifiedEntries = reReadVault ? await decryptData<VaultEntry[]>(reReadVault, pass) : finalVaultEntries;

      const reReadMbs = await storage.getEncryptedMailboxes();
      const verifiedMailboxes = reReadMbs ? await decryptData<MailboxAccount[]>(reReadMbs, pass) : finalMailboxes;

      set({
        vaultEntries: verifiedEntries,
        mailboxes: verifiedMailboxes,
        lastActivityTime: Date.now(),
      });

      return {
        success: true,
        addedVaultCount,
        addedMailboxCount,
      };
    } catch (err: any) {
      return {
        success: false,
        addedVaultCount: 0,
        addedMailboxCount: 0,
        error: err.message || 'Import failed.',
      };
    }
  },

  // Inbox
  mailboxes: [],
  selectedMailbox: null,
  mailboxSearchQuery: '',
  messages: [],
  selectedMessage: null,
  isLoadingMailboxes: false,
  isLoadingMessages: false,
  isLoadingMessageDetail: false,
  isCreatingMailbox: false,
  inboxError: null,

  setMailboxSearchQuery: (q: string) => {
    get().recordActivity();
    set({ mailboxSearchQuery: q });
  },

  loadMailboxes: async () => {
    let encDecryptedMbs: MailboxAccount[] = [];

    const encMbs = await storage.getEncryptedMailboxes();
    if (encMbs && get().masterPasswordSession) {
      try {
        encDecryptedMbs = (await decryptData<MailboxAccount[]>(encMbs, get().masterPasswordSession!)) || [];
      } catch {}
    }

    const mbMap = new Map<string, MailboxAccount>();
    [...get().mailboxes, ...encDecryptedMbs].forEach((m) => mbMap.set(m.address.toLowerCase(), m));
    
    // Auto-backfill tags from vault entries if missing
    const vaultList = get().vaultEntries;
    const finalMbs = Array.from(mbMap.values()).map((m) => {
      if (!m.nameTag || !m.associatedHostname) {
        const matchedEntry = vaultList.find((e) =>
          Object.values(e.fields || {}).some((v) => v.toLowerCase() === m.address.toLowerCase()) ||
          e.primaryIdentifier.toLowerCase() === m.address.toLowerCase()
        );
        if (matchedEntry) {
          return {
            ...m,
            nameTag: m.nameTag || matchedEntry.primaryIdentifier,
            associatedHostname: m.associatedHostname || matchedEntry.hostname,
          };
        }
      }
      return m;
    });

    set({ mailboxes: finalMbs });
  },

  createMailbox: async (nameTag?: string) => {
    get().recordActivity();
    if (!get().isVaultInitialized || !get().isVaultUnlocked) {
      set({ activeTab: 'vault' });
      return null;
    }
    set({ isCreatingMailbox: true, inboxError: null });
    try {
      const newAccount = await mailTm.createRandomAccount();
      if (nameTag && nameTag.trim()) {
        newAccount.nameTag = nameTag.trim();
      }

      const existing = get().mailboxes;
      const updated = [newAccount, ...existing.filter((m) => m.address !== newAccount.address)];
      set({
        mailboxes: updated,
        isCreatingMailbox: false,
      });

      if (get().masterPasswordSession) {
        const payload = await encryptData(updated, get().masterPasswordSession!);
        await storage.saveEncryptedMailboxes(payload);
      }

      return newAccount;
    } catch (err: any) {
      set({
        isCreatingMailbox: false,
        inboxError: err.message || 'Failed to create temporary mailbox',
      });
      return null;
    }
  },

  openMailboxByAddress: async (address: string, nameTag?: string, hostname?: string) => {
    get().recordActivity();
    const cleanAddr = address.trim().toLowerCase();
    const { mailboxes, vaultEntries } = get();

    // Look up matching vault credential if nameTag/hostname not provided
    const matchingEntry = vaultEntries.find((e) =>
      Object.values(e.fields || {}).some((v) => v.toLowerCase() === cleanAddr) ||
      e.primaryIdentifier.toLowerCase() === cleanAddr
    );
    const resolvedName = nameTag || matchingEntry?.primaryIdentifier;
    const resolvedHost = hostname || matchingEntry?.hostname;

    let matched = mailboxes.find((m) => m.address.toLowerCase() === cleanAddr);
    if (matched) {
      if ((!matched.nameTag && resolvedName) || (!matched.associatedHostname && resolvedHost)) {
        matched = {
          ...matched,
          nameTag: matched.nameTag || resolvedName,
          associatedHostname: matched.associatedHostname || resolvedHost,
        };
        const updatedMbs = mailboxes.map((m) => (m.id === matched!.id ? matched! : m));
        set({ mailboxes: updatedMbs });
        if (get().masterPasswordSession) {
          const payload = await encryptData(updatedMbs, get().masterPasswordSession!);
          await storage.saveEncryptedMailboxes(payload);
        }
      }
      set({
        activeTab: 'inbox',
        selectedMailbox: matched,
        selectedMessage: null,
      });
      await get().fetchMessages(matched);
    } else {
      // Provision/create mailbox entry for this address with tags attached
      const fallbackMb: MailboxAccount = {
        id: `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        address: cleanAddr,
        password: 'PhakePass123!A',
        createdAt: Date.now(),
        unreadCount: 0,
        nameTag: resolvedName,
        associatedHostname: resolvedHost,
      };
      const updated = [fallbackMb, ...mailboxes];
      set({
        mailboxes: updated,
        activeTab: 'inbox',
        selectedMailbox: fallbackMb,
        selectedMessage: null,
      });
      if (get().masterPasswordSession) {
        const payload = await encryptData(updated, get().masterPasswordSession!);
        await storage.saveEncryptedMailboxes(payload);
      }
      await get().fetchMessages(fallbackMb);
    }
  },

  deleteMailbox: async (id: string) => {
    get().recordActivity();
    const mb = get().mailboxes.find((m) => m.id === id);
    const updated = get().mailboxes.filter((m) => m.id !== id);

    set({
      mailboxes: updated,
      selectedMailbox: get().selectedMailbox?.id === id ? null : get().selectedMailbox,
    });

    if (mb) {
      mailTm.deleteAccount(mb).catch(() => {});
    }

    if (get().masterPasswordSession) {
      const payload = await encryptData(updated, get().masterPasswordSession!);
      await storage.saveEncryptedMailboxes(payload);
    }
  },

  selectMailbox: async (mailbox: MailboxAccount | null) => {
    get().recordActivity();
    if (!mailbox) {
      activeFetchMailboxId = null;
      activeDetailMessageId = null;
      set({ selectedMailbox: null, selectedMessage: null, messages: [] });
      return;
    }
    activeFetchMailboxId = mailbox.id;
    activeDetailMessageId = null;
    set({ selectedMailbox: mailbox, selectedMessage: null, messages: [] });
    await get().fetchMessages(mailbox);
  },

  fetchMessages: async (mailbox?: MailboxAccount) => {
    const target = mailbox || get().selectedMailbox;
    if (!target) return;
    const targetId = target.id;
    if (mailbox) {
      activeFetchMailboxId = targetId;
    }

    set({ isLoadingMessages: true, inboxError: null });
    try {
      const list = await mailTm.getMessages(target);

      // Check if user still has this mailbox open
      const isStillOpen = get().selectedMailbox?.id === targetId;

      // Merge seen status from persistent storage + existing seen messages
      const seenSet = await storage.getSeenMessageIds();
      get().messages.forEach((m) => {
        if (m.seen) seenSet.add(m.id);
      });

      // Robust de-duplicating merge so messages are persistent and never dropped
      const existingMsgs = get().messages;
      const msgMap = new Map<string, MailMessageSummary>();
      list.forEach((m) => {
        const isSeen = m.seen || seenSet.has(m.id);
        msgMap.set(m.id, { ...m, seen: isSeen });
      });
      existingMsgs.forEach((m) => {
        if (!msgMap.has(m.id) && m.accountId === targetId) {
          msgMap.set(m.id, m);
        }
      });
      const finalList = Array.from(msgMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const unread = finalList.filter((m) => !m.seen).length;

      const updatedMailboxes = get().mailboxes.map((m) =>
        m.id === target.id || m.address.toLowerCase() === target.address.toLowerCase()
          ? {
              ...m,
              address: target.address,
              token: target.token || m.token,
              unreadCount: unread,
              lastMessageAt: finalList.length > 0 ? new Date(finalList[0].createdAt).getTime() : m.lastMessageAt,
            }
          : m
      );

      // Only update selectedMailbox and messages in state if the user has NOT closed this mailbox
      if (isStillOpen && (activeFetchMailboxId === targetId || !activeFetchMailboxId)) {
        set({
          messages: finalList,
          selectedMailbox: { ...target, unreadCount: unread },
          mailboxes: updatedMailboxes,
          isLoadingMessages: false,
          inboxError: null,
        });
      } else {
        set({
          mailboxes: updatedMailboxes,
          isLoadingMessages: false,
          inboxError: null,
        });
      }

      // Save updated mailbox token state
      if (get().isVaultUnlocked && get().masterPasswordSession) {
        const enc = await encryptData(updatedMailboxes, get().masterPasswordSession!);
        await storage.saveEncryptedMailboxes(enc);
      }
    } catch (err: any) {
      set({
        isLoadingMessages: false,
        inboxError: null,
      });
    }
  },

  selectMessage: async (msg: MailMessageSummary | null) => {
    get().recordActivity();
    if (!msg) {
      activeDetailMessageId = null;
      set({ selectedMessage: null });
      return;
    }

    const currentMailbox = get().selectedMailbox;
    if (!currentMailbox) return;

    const targetMsgId = msg.id;
    activeDetailMessageId = targetMsgId;

    // Immediately mark message as seen locally & in persistent storage
    const seenSet = await storage.getSeenMessageIds();
    seenSet.add(targetMsgId);
    storage.saveSeenMessageIds(seenSet).catch(() => {});

    // Update message seen flag and recalculate unread count immediately
    const updatedMessages = get().messages.map((m) => (m.id === targetMsgId ? { ...m, seen: true } : m));
    const newUnread = updatedMessages.filter((m) => !m.seen).length;

    const updatedMailboxes = get().mailboxes.map((m) =>
      m.id === currentMailbox.id || m.address.toLowerCase() === currentMailbox.address.toLowerCase()
        ? { ...m, unreadCount: newUnread }
        : m
    );

    set({
      messages: updatedMessages,
      selectedMailbox: { ...currentMailbox, unreadCount: newUnread },
      mailboxes: updatedMailboxes,
      isLoadingMessageDetail: true,
      inboxError: null,
    });

    if (get().isVaultUnlocked && get().masterPasswordSession) {
      encryptData(updatedMailboxes, get().masterPasswordSession!).then((enc) =>
        storage.saveEncryptedMailboxes(enc)
      ).catch(() => {});
    }

    try {
      const detail = await mailTm.getMessage(currentMailbox, targetMsgId);
      if (activeDetailMessageId === targetMsgId) {
        set({
          selectedMessage: { ...detail, seen: true },
          isLoadingMessageDetail: false,
        });
      }
    } catch (err: any) {
      if (activeDetailMessageId === targetMsgId) {
        set({
          isLoadingMessageDetail: false,
          inboxError: err.message || 'Failed to load message body',
        });
      }
    }
  },

  deleteMessage: async (messageId: string) => {
    get().recordActivity();
    const currentMailbox = get().selectedMailbox;
    if (!currentMailbox) return;

    try {
      await mailTm.deleteMessage(currentMailbox, messageId);
      const remainingMessages = get().messages.filter((m) => m.id !== messageId);
      const newUnread = remainingMessages.filter((m) => !m.seen).length;
      const updatedMailboxes = get().mailboxes.map((m) =>
        m.id === currentMailbox.id || m.address.toLowerCase() === currentMailbox.address.toLowerCase()
          ? { ...m, unreadCount: newUnread }
          : m
      );

      set((state) => ({
        messages: remainingMessages,
        selectedMailbox: state.selectedMailbox ? { ...state.selectedMailbox, unreadCount: newUnread } : null,
        mailboxes: updatedMailboxes,
        selectedMessage: state.selectedMessage?.id === messageId ? null : state.selectedMessage,
      }));

      if (get().isVaultUnlocked && get().masterPasswordSession) {
        const enc = await encryptData(updatedMailboxes, get().masterPasswordSession!);
        storage.saveEncryptedMailboxes(enc).catch(() => {});
      }
    } catch (err: any) {
      set({ inboxError: err.message || 'Failed to delete message' });
    }
  },

  clearInboxError: () => set({ inboxError: null }),
}));

// Live cross-context storage sync across tabs, overlays, and popup
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.phake_vault_encrypted) {
        useStore.getState().checkVaultStatus();
      }
      if (changes.phake_mailboxes_encrypted) {
        useStore.getState().loadMailboxes();
      }
      if (changes.phake_settings) {
        const newSettings = changes.phake_settings.newValue;
        if (newSettings) {
          useStore.setState({ settings: newSettings });
          applyDesignTokens(newSettings.density);
        }
      }
    } else if (areaName === 'session') {
      if (changes.phake_session_vault_password || changes.phake_session_last_activity) {
        useStore.getState().checkVaultStatus();
      }
    }
  });
}

// Periodic Auto-Lock monitor: locks vault when inactive past user's timeout setting
if (typeof window !== 'undefined') {
  setInterval(async () => {
    const state = useStore.getState();
    if (state.isVaultUnlocked && state.masterPasswordSession) {
      const timeoutMinutes = state.settings.autoLockTimeoutMinutes ?? 5;
      if (timeoutMinutes === -1) return; // "Never" mode: never auto-locks on inactivity during session

      const timeoutMs = timeoutMinutes * 60 * 1000;
      const session = await storage.getVaultSession();
      const lastActive = session.lastActivity || state.lastActivityTime || Date.now();
      if (Date.now() - lastActive >= timeoutMs) {
        state.lockVault();
      }
    }
  }, 2000);
}
