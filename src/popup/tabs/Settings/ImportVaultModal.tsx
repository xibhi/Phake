import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  KeyRound,
  FileCode,
  AlertCircle,
  Check,
  ShieldAlert,
  Layers,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';
import {
  validatePhakeEnvelope,
  decryptPhakePayload,
  calculateImportPreview,
  validatePhakeFileSize,
  MAX_PHAKE_IMPORT_SIZE_BYTES,
} from '../../../lib/phake-import';
import {
  evaluatePasswordStrength,
  formatRecoveryKey,
  generateSecretRecoveryKey,
} from '../../../lib/crypto';
import { PhakeExportEnvelope, PhakeExportPayload, PhakeImportPreview } from '../../../lib/types';

interface ImportVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep =
  | 'file'
  | 'recovery_key'
  | 'create_password'
  | 'preview'
  | 'unlock_vault'
  | 'account_recovery'
  | 'success';

export const ImportVaultModal: React.FC<ImportVaultModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const isVaultUnlocked = useStore((s) => s.isVaultUnlocked);
  const vaultEntries = useStore((s) => s.vaultEntries);
  const mailboxes = useStore((s) => s.mailboxes);
  const commitPhakeImport = useStore((s) => s.commitPhakeImport);
  const unlockVault = useStore((s) => s.unlockVault);
  const recoverVaultWithKey = useStore((s) => s.recoverVaultWithKey);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasFreshInstallRef = useRef(!isVaultInitialized);

  const [step, setStep] = useState<ImportStep>('file');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<PhakeExportEnvelope | null>(null);

  const [recoveryKey, setRecoveryKey] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [newVaultRecoveryKey, setNewVaultRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // In-modal unlock & account recovery state
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');
  const [showRecoveryNewPassword, setShowRecoveryNewPassword] = useState(false);
  const [showConfirmRecoveryPassword, setShowConfirmRecoveryPassword] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [decryptedPayload, setDecryptedPayload] = useState<PhakeExportPayload | null>(null);
  const [preview, setPreview] = useState<PhakeImportPreview | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ vaultCount: number; mailboxCount: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      wasFreshInstallRef.current = !isVaultInitialized;
      setStep('file');
      setFileContent(null);
      setFileName(null);
      setEnvelope(null);
      setRecoveryKey('');
      setNewMasterPassword('');
      setConfirmMasterPassword('');
      setNewVaultRecoveryKey('');
      setShowPassword(false);
      setCopiedKey(false);
      setUnlockPassword('');
      setShowUnlockPassword(false);
      setIsUnlocking(false);
      setRecoveryKeyInput('');
      setRecoveryNewPassword('');
      setConfirmRecoveryPassword('');
      setShowRecoveryNewPassword(false);
      setShowConfirmRecoveryPassword(false);
      setIsRecovering(false);
      setRecoveryError(null);
      setDecryptedPayload(null);
      setPreview(null);
      setImportMode('merge');
      setIsLoading(false);
      setError(null);
      setImportResult(null);
    }
  }, [isOpen, isVaultInitialized]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    // SEC-04: Synchronous file size check before reading file into memory
    const sizeCheck = validatePhakeFileSize(file.size);
    if (!sizeCheck.valid) {
      setError(sizeCheck.error || 'This file is too large to be a valid Phake backup.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsLoading(true);

    try {
      const text = await file.text();
      setFileContent(text);

      // Step 2.1, 2.2, 2.3 validation
      const validation = await validatePhakeEnvelope(text);
      if (!validation.success || !validation.envelope) {
        setError(validation.error || "This doesn't look like a Phake backup file.");
        setIsLoading(false);
        return;
      }

      setEnvelope(validation.envelope);
      setStep('recovery_key');
      setError(null);
    } catch {
      setError("This doesn't look like a Phake backup file.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envelope) return;

    setError(null);
    if (!recoveryKey.trim()) {
      setError('Enter the Secret Recovery Key for this backup.');
      return;
    }

    setIsLoading(true);
    const result = await decryptPhakePayload(envelope, recoveryKey.trim());
    setIsLoading(false);

    if (!result.success || !result.payload) {
      setError(result.error || "That Secret Recovery Key doesn't match this file, or the file is corrupted.");
      return;
    }

    setDecryptedPayload(result.payload);
    setError(null);

    // If vault is not initialized on this device, prompt to create a local master password
    if (!isVaultInitialized) {
      const generatedKey = generateSecretRecoveryKey();
      setNewVaultRecoveryKey(generatedKey);
      setStep('create_password');
    } else {
      const previewData = calculateImportPreview(result.payload, vaultEntries, mailboxes);
      setPreview(previewData);
      setStep('preview');
    }
  };

  const strength = evaluatePasswordStrength(newMasterPassword);

  const handleCopyNewVaultKey = () => {
    if (!newVaultRecoveryKey) return;
    navigator.clipboard.writeText(newVaultRecoveryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCreatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newMasterPassword.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }

    if (newMasterPassword !== confirmMasterPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (decryptedPayload) {
      const previewData = calculateImportPreview(decryptedPayload, [], []);
      setPreview(previewData);
      setStep('preview');
    }
  };

  const handleConfirmImport = async () => {
    if (!decryptedPayload) return;

    setError(null);

    // If vault is initialized on this device but currently locked, prompt to unlock directly
    if (isVaultInitialized && !isVaultUnlocked) {
      setUnlockPassword('');
      setError(null);
      setStep('unlock_vault');
      return;
    }

    setIsLoading(true);

    const targetPassword = !isVaultInitialized ? newMasterPassword : undefined;
    const targetRecKey = !isVaultInitialized ? newVaultRecoveryKey : undefined;
    const res = await commitPhakeImport(importMode, decryptedPayload, targetPassword, targetRecKey);
    setIsLoading(false);

    if (res.success) {
      setImportResult({
        vaultCount: res.addedVaultCount,
        mailboxCount: res.addedMailboxCount,
      });
      setStep('success');
    } else {
      if (res.error?.toLowerCase().includes('unlock') || res.error?.toLowerCase().includes('locked')) {
        setUnlockPassword('');
        setError('Vault must be unlocked to import.');
        setStep('unlock_vault');
      } else {
        setError(res.error || 'Import failed.');
      }
    }
  };

  const handleExecuteUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) return;

    setError(null);
    setIsUnlocking(true);
    const unlocked = await unlockVault(unlockPassword);

    if (!unlocked) {
      setIsUnlocking(false);
      setError('Incorrect master password. Please try again.');
      return;
    }

    // Vault is unlocked! Proceed with import immediately.
    if (decryptedPayload) {
      const res = await commitPhakeImport(importMode, decryptedPayload, unlockPassword);
      setIsUnlocking(false);

      if (res.success) {
        setImportResult({
          vaultCount: res.addedVaultCount,
          mailboxCount: res.addedMailboxCount,
        });
        setStep('success');
      } else {
        setError(res.error || 'Import failed.');
      }
    } else {
      setIsUnlocking(false);
    }
  };

  const handleExecuteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    if (!recoveryKeyInput.trim()) {
      setRecoveryError('Please enter your Secret Recovery Key.');
      return;
    }

    if (recoveryNewPassword.length < 8) {
      setRecoveryError('New master password must be at least 8 characters long.');
      return;
    }

    if (recoveryNewPassword !== confirmRecoveryPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setIsRecovering(true);
    const success = await recoverVaultWithKey(recoveryKeyInput.trim(), recoveryNewPassword);

    if (!success) {
      setIsRecovering(false);
      setRecoveryError('Incorrect Secret Recovery Key. Please check and try again.');
      return;
    }

    // Vault is recovered and unlocked with new password! Proceed with import immediately.
    if (decryptedPayload) {
      const res = await commitPhakeImport(importMode, decryptedPayload, recoveryNewPassword);
      setIsRecovering(false);

      if (res.success) {
        setImportResult({
          vaultCount: res.addedVaultCount,
          mailboxCount: res.addedMailboxCount,
        });
        setStep('success');
      } else {
        setRecoveryError(res.error || 'Import failed.');
      }
    } else {
      setIsRecovering(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'file'
          ? 'Import Vault'
          : step === 'recovery_key'
          ? 'Decrypt Backup'
          : step === 'create_password'
          ? 'Device Master Password'
          : step === 'preview'
          ? 'Import Preview'
          : step === 'unlock_vault'
          ? 'Unlock Vault'
          : step === 'account_recovery'
          ? 'Account Recovery'
          : 'Import Complete'
      }
    >
      {/* STEP 1: Select File */}
      {step === 'file' && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[12px] text-[#8E8E93] leading-relaxed">
            Select a <strong>.phake</strong> backup file to restore your encrypted vault credentials and mailboxes.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".phake,.json"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#48484C]/50 hover:bg-[#48484C] border border-dashed border-white/25 hover:border-white/40 transition-all cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-sm">
              <Upload className="w-5 h-5 text-white/80" />
            </div>
            <span className="text-[13.5px] font-bold text-white">Choose .phake backup file</span>
            <span className="text-[11px] text-[#8E8E93] mt-0.5">Click to browse your device</span>
          </button>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Recovery Key Prompt */}
      {step === 'recovery_key' && (
        <form onSubmit={handleDecrypt} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-[#8E8E93] text-[12px] leading-relaxed">
            <KeyRound className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Enter Secret Recovery Key</p>
              <p className="mt-0.5 text-[11.5px] text-[#8E8E93]">
                Enter the 24-character Secret Recovery Key associated with this backup to decrypt the payload.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Secret Recovery Key</label>
            <input
              type="text"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              required
              autoFocus
              className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white font-mono text-[13px] rounded-xl px-3 py-2.5 focus:outline-none transition-colors shadow-sm placeholder:text-white/40 tracking-wider uppercase"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('file');
                setError(null);
              }}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !recoveryKey.trim()}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Decrypting...' : 'Decrypt Backup'}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 2.5: Fresh Install Create Master Password */}
      {step === 'create_password' && (
        <form onSubmit={handleCreatePassword} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-[#8E8E93] text-[12px] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <span>
              Backup decrypted successfully. Create a master password to protect this vault locally on this device.
            </span>
          </div>

          {/* Master Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">New Master Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newMasterPassword}
                onChange={(e) => setNewMasterPassword(e.target.value)}
                placeholder="At least 8 characters..."
                required
                autoFocus
                className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white text-[13.5px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {newMasterPassword.length > 0 && (
              <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8E8E93]">Strength:</span>
                  <span style={{ color: strength.color }} className="font-semibold">
                    {strength.label}
                  </span>
                </div>
                <div className="flex gap-1 h-1.5 w-full bg-[#48484C] rounded-full overflow-hidden">
                  {[0, 1, 2, 3].map((stepIdx) => (
                    <div
                      key={stepIdx}
                      className="flex-1 h-full rounded-full transition-colors"
                      style={{
                        backgroundColor:
                          stepIdx <= strength.score ? strength.color : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmMasterPassword}
              onChange={(e) => setConfirmMasterPassword(e.target.value)}
              placeholder="Re-enter password..."
              required
              className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white text-[13.5px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
            />
          </div>

          {/* Secret Recovery Key Display Box for the Receiver's New Vault */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#48484C]/50 border border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-[#8E8E93] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-white/70" />
                <span>Secret Recovery Key</span>
              </span>
              <button
                type="button"
                onClick={handleCopyNewVaultKey}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-semibold text-white transition-colors cursor-pointer shrink-0 shadow-sm"
                title="Copy Secret Key"
              >
                {copiedKey ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[13px] font-mono font-bold text-white tracking-wider select-all pt-0.5">
              {newVaultRecoveryKey}
            </div>
            <p className="text-[10.5px] text-[#8E8E93] leading-normal mt-0.5">
              Store this secret key safely. It is the only way to recover your vault or reset your master password on this device.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('recovery_key');
                setError(null);
              }}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={newMasterPassword.length < 8 || newMasterPassword !== confirmMasterPassword}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Continue</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Preview & Merge Options */}
      {step === 'preview' && preview && (
        <div className="flex flex-col gap-3.5">
          {/* Summary Box */}
          <div className="p-3.5 rounded-xl bg-[#48484C]/50 border border-white/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[12.5px] font-medium">
              <span className="text-[#8E8E93]">Vault Credentials:</span>
              <span className="text-white font-bold">
                {preview.vaultEntriesCount} items{' '}
                {isVaultInitialized && (
                  <span className="text-[11px] text-[#8E8E93] font-normal">
                    ({preview.newVaultCount} new, {preview.duplicateVaultCount} duplicates)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12.5px] font-medium border-t border-white/10 pt-2">
              <span className="text-[#8E8E93]">Mailbox Inboxes:</span>
              <span className="text-white font-bold">
                {preview.mailboxesCount} inboxes{' '}
                {isVaultInitialized && (
                  <span className="text-[11px] text-[#8E8E93] font-normal">
                    ({preview.newMailboxCount} new, {preview.duplicateMailboxCount} duplicates)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Mode Selector if Vault is already initialized */}
          {isVaultInitialized && (
            <div className="flex flex-col gap-2 pt-0.5">
              <label className="text-[12px] font-medium text-[#8E8E93]">Import Method</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    importMode === 'merge'
                      ? 'bg-white/10 border-white/30 text-white shadow-sm'
                      : 'bg-[#48484C]/40 border-white/10 text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <p className="text-[13px] font-bold text-white leading-tight">
                      Merge (Skip Duplicates)
                    </p>
                    <p className="text-[11px] text-[#8E8E93] mt-0.5">
                      Adds {preview.newVaultCount} new credentials without modifying existing entries.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    importMode === 'replace'
                      ? 'bg-red-500/10 border-red-500/30 text-white shadow-sm'
                      : 'bg-[#48484C]/40 border-white/10 text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p className="text-[13px] font-bold text-white leading-tight">
                      Replace Entire Vault
                    </p>
                    <p className="text-[11px] text-[#8E8E93] mt-0.5">
                      Overwrites local vault with {preview.vaultEntriesCount} credentials from the backup file.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {(error.toLowerCase().includes('unlock') || error.toLowerCase().includes('locked')) && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setUnlockPassword('');
                    setStep('unlock_vault');
                  }}
                  className="self-start px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11.5px] font-semibold text-white transition-colors cursor-pointer"
                >
                  Unlock Now
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setStep('recovery_key');
                setError(null);
              }}
              disabled={isLoading}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isLoading}
              className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
                importMode === 'replace'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Importing...' : importMode === 'replace' ? 'Replace Vault' : 'Merge Vault'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3.5: Unlock Vault */}
      {step === 'unlock_vault' && (
        <form onSubmit={handleExecuteUnlock} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-[#8E8E93] text-[12px] leading-relaxed">
            <Lock className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <span>
              Your vault is locked. Enter your master password to unlock and complete the import.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Master Password</label>
            <div className="relative flex items-center">
              <input
                type={showUnlockPassword ? 'text' : 'password'}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter master password..."
                autoFocus
                required
                className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white text-[13.5px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
              >
                {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setStep('preview');
                setError(null);
              }}
              disabled={isUnlocking}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isUnlocking || !unlockPassword}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{isUnlocking ? 'Unlocking...' : 'Unlock & Import'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('account_recovery');
              setError(null);
              setRecoveryError(null);
              setRecoveryKeyInput('');
              setRecoveryNewPassword('');
              setConfirmRecoveryPassword('');
            }}
            className="text-[12px] text-[#8E8E93] hover:text-white transition-colors text-center py-1 focus:outline-none cursor-pointer flex items-center justify-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Forgot password?</span>
          </button>
        </form>
      )}

      {/* STEP 3.6: Account Recovery with Secret Key */}
      {step === 'account_recovery' && (
        <form onSubmit={handleExecuteRecovery} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11.5px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Enter your Secret Recovery Key provided during vault creation to reset your password and complete the import.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[#8E8E93] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-white/70" />
              <span>Secret Recovery Key</span>
            </label>
            <input
              type="text"
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              required
              autoFocus
              className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 text-white font-mono text-[13px] rounded-xl px-3 py-2.5 focus:outline-none transition-colors shadow-sm placeholder:text-white/40 tracking-wider uppercase"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[#8E8E93]">New Master Password</label>
              <div className="relative flex items-center">
                <input
                  type={showRecoveryNewPassword ? 'text' : 'password'}
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="At least 8 characters..."
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowRecoveryNewPassword(!showRecoveryNewPassword)}
                  className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                >
                  {showRecoveryNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[#8E8E93]">Confirm Password</label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmRecoveryPassword ? 'text' : 'password'}
                  value={confirmRecoveryPassword}
                  onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmRecoveryPassword(!showConfirmRecoveryPassword)}
                  className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                >
                  {showConfirmRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {recoveryError && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11.5px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{recoveryError}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('unlock_vault');
                setRecoveryError(null);
              }}
              disabled={isRecovering}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isRecovering || !recoveryKeyInput.trim() || recoveryNewPassword.length < 8}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isRecovering ? 'Resetting...' : 'Reset & Import'}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: Success State */}
      {step === 'success' && importResult && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[12px] leading-relaxed">
            <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold text-white">Import Successful</p>
              <p className="mt-0.5 text-[11.5px] text-emerald-300">
                Added {importResult.vaultCount} vault {importResult.vaultCount === 1 ? 'credential' : 'credentials'} and{' '}
                {importResult.mailboxCount} {importResult.mailboxCount === 1 ? 'inbox' : 'inboxes'}.
              </p>
            </div>
          </div>

          {wasFreshInstallRef.current && (
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#48484C]/50 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-[#8E8E93] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-white/70" />
                  <span>Vault Secret Recovery Key</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyNewVaultKey}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-semibold text-white transition-colors cursor-pointer"
                  title="Copy Secret Key"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-[12.5px] font-mono font-bold text-white tracking-wider select-all pt-0.5">
                {newVaultRecoveryKey}
              </div>
            </div>
          )}

          <p className="text-[12px] text-[#8E8E93] leading-relaxed px-1">
            Your imported data was re-encrypted under your local device's master password key and is ready to use in the Vault and Inbox tabs.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all cursor-pointer shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
