export type TabId = 'filler' | 'vault' | 'inbox' | 'settings';
export type { CountryLocale } from './locales';

export type FieldType =
  | 'title'
  | 'first_name'
  | 'middle_name'
  | 'middle_initial'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'password'
  | 'confirm_password'
  | 'username'
  | 'phone'
  | 'phone_home'
  | 'phone_work'
  | 'phone_mobile'
  | 'fax'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'company'
  | 'job_title'
  | 'website'
  | 'card_type'
  | 'card_number'
  | 'card_cvv'
  | 'card_exp_month'
  | 'card_exp_year'
  | 'bank_name'
  | 'card_phone'
  | 'ssn'
  | 'driver_license'
  | 'birth_place'
  | 'dob'
  | 'dob_month'
  | 'dob_day'
  | 'dob_year'
  | 'age'
  | 'income'
  | 'comments'
  | 'custom'
  | 'gender'
  | 'unknown';

export interface DetectedField {
  id: string;
  selector: string;
  type: FieldType;
  label: string;
  name?: string;
  placeholder?: string;
  autocomplete?: string;
  isRequired?: boolean;
  value?: string;
  currentValue?: string;
  formIndex?: number;
}

export interface PageAnalysisResult {
  url: string;
  hostname: string;
  title: string;
  faviconUrl?: string;
  fields: DetectedField[];
  formCount: number;
  timestamp: number;
}

export interface GeneratedFieldItem {
  id: string;
  selector: string;
  type: FieldType;
  label: string;
  value: string;
  isModifiedByUser?: boolean;
}

export interface FillRequestPayload {
  url: string;
  hostname: string;
  title: string;
  faviconUrl?: string;
  fields: {
    selector: string;
    type: FieldType;
    value: string;
  }[];
}

export type FillRequest = FillRequestPayload;

export interface FillResult {
  success: boolean;
  filledCount: number;
  totalCount?: number;
  errors?: string[];
}

export interface EncryptedVaultPayload {
  version: 1;
  ciphertext: string; // Base64 encoded AES-GCM encrypted payload
  iv: string; // Base64 encoded 12-byte IV
  salt: string; // Base64 encoded 16-byte PBKDF2 salt
  recoveryKeyHash?: string; // PBKDF2 salted hash of the normalized secret recovery key
  recoveryKeySalt?: string; // Salt for the recovery key hash
  encryptedRecoveryKey?: string; // Plaintext recovery key encrypted with Master Password
  encryptedRecoveryKeyIv?: string;
  encryptedRecoveryKeySalt?: string;
  recoveryCiphertext?: string; // Vault entries encrypted with the secret recovery key
  recoveryIv?: string;
  recoverySalt?: string;
  updatedAt?: number;
}

export interface VaultEntry {
  id: string;
  credentialNumber?: number;
  credentialLabel?: string;
  hostname: string;
  siteName: string;
  url: string;
  faviconUrl?: string;
  primaryIdentifier: string; // usually email or username
  password?: string;
  fields: Record<string, string>; // key: field label, val: generated value
  createdAt: number;
  lastUsedAt: number;
  isGeneratedInbox?: boolean;
}

export interface MailboxAccount {
  id: string;
  address: string;
  password: string;
  token?: string;
  createdAt: number;
  unreadCount: number;
  lastMessageAt?: number;
  associatedHostname?: string;
  nameTag?: string;
}

export interface MailMessageSummary {
  id: string;
  accountId: string;
  msgid: string;
  from: {
    address: string;
    name: string;
  };
  to: {
    address: string;
    name: string;
  }[];
  subject: string;
  intro: string;
  seen: boolean;
  isDeleted: boolean;
  hasAttachments: boolean;
  size: number;
  downloadUrl: string;
  createdAt: string;
  retentionDate?: string;
}

export interface MailAttachment {
  id: string;
  filename: string;
  contentType: string;
  disposition: string;
  transferEncoding: string;
  related: boolean;
  size: number;
  downloadUrl: string;
}

export interface MailMessageDetail extends MailMessageSummary {
  text?: string;
  html?: string[];
  attachments: MailAttachment[];
}

export type DensityMode = 'comfortable' | 'compact';

export type AutoLockTimeout = 1 | 5 | 15 | 30 | -1; // -1 for never

export interface AppSettings {
  density: DensityMode;
  defaultCountry: string; // e.g. "US", "GB", "IN", "DE", etc.
  autoLockTimeoutMinutes: AutoLockTimeout;
}

export interface NavigationTarget {
  tab: TabId;
  params?: {
    mailboxId?: string;
    messageId?: string;
    vaultEntryId?: string;
  };
}

export interface PhakeExportEnvelope {
  phake_export: true;
  format_version: number;
  exported_at: string;
  phake_signature: string;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string;
  };
  payload: string; // Base64 encoded AES-GCM ciphertext
}

export interface PhakeExportPayload {
  version: number;
  vaultEntries: VaultEntry[];
  mailboxes: MailboxAccount[];
  exportedAt?: string;
}

export interface PhakeImportPreview {
  vaultEntriesCount: number;
  mailboxesCount: number;
  duplicateVaultCount: number;
  duplicateMailboxCount: number;
  newVaultCount: number;
  newMailboxCount: number;
  payload: PhakeExportPayload;
}

export type UpdateCheckStatus = 'idle' | 'checking' | 'up_to_date' | 'update_available' | 'failed';

export interface UpdateCheckInfo {
  status: UpdateCheckStatus;
  updateAvailable: boolean;
  lastCheckedAt: number | null;
  lastKnownRemoteVersion: string | null;
  updateUrl: string;
}

export interface BackgroundMessage {
  type:
    | 'PAGE_ANALYSIS_REQUEST'
    | 'PAGE_ANALYSIS_RESULT'
    | 'EXECUTE_FILL'
    | 'EXECUTE_FILL_RESPONSE'
    | 'SET_VAULT_SESSION_KEY'
    | 'GET_VAULT_SESSION_KEY'
    | 'CLEAR_VAULT_SESSION_KEY'
    | 'NAVIGATE_TO'
    | 'MAIL_POLL_TICK'
    | 'API_PROXY_REQUEST'
    | 'CHECK_FOR_UPDATES';
  payload?: any;
}

