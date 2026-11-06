import React, { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff, KeyRound, Lock, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const verifyMasterPassword = useStore((s) => s.verifyMasterPassword);
  const verifyRecoveryKey = useStore((s) => s.verifyRecoveryKey);

  const [step, setStep] = useState<'auth' | 'confirm'>('auth');
  const [method, setMethod] = useState<'password' | 'recovery_key'>('password');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(isVaultInitialized ? 'auth' : 'confirm');
      setMethod('password');
      setPassword('');
      setRecoveryKey('');
      setError(null);
      setShowPassword(false);
      setIsVerifying(false);
      setIsClearing(false);
    }
  }, [isOpen, isVaultInitialized]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      if (method === 'password') {
        if (!password) {
          setError('Please enter your vault password.');
          setIsVerifying(false);
          return;
        }
        const valid = await verifyMasterPassword(password);
        if (!valid) {
          setError('Incorrect master password.');
          setIsVerifying(false);
          return;
        }
      } else {
        if (!recoveryKey.trim()) {
          setError('Please enter your Secret Recovery Key.');
          setIsVerifying(false);
          return;
        }
        const valid = await verifyRecoveryKey(recoveryKey.trim());
        if (!valid) {
          setError('Incorrect Secret Recovery Key.');
          setIsVerifying(false);
          return;
        }
      }

      // Password verified -> advance to Step 2
      setStep('confirm');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExecuteKaboom = async () => {
    setError(null);
    setIsClearing(true);

    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wipe failed.');
      setIsClearing(false);
    }
  };

  if (step === 'auth') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Authentication">
        <form onSubmit={handleVerifyPassword} className="flex flex-col gap-3.5">
          <p className="text-[12.5px] text-[#8E8E93] leading-relaxed">
            Enter your vault password to continue.
          </p>

          {isVaultInitialized && (
            <div className="flex flex-col gap-3">
              {/* 2-Method Tab Switcher */}
              <div className="flex p-1 rounded-xl bg-[#3A3A3C] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMethod('password');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    method === 'password'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod('recovery_key');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    method === 'recovery_key'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Secret Key</span>
                </button>
              </div>

              {method === 'password' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#8E8E93]">
                    Vault Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter vault password..."
                      autoFocus
                      required
                      className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 pr-9 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#8E8E93]">
                    Secret Recovery Key
                  </label>
                  <input
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    autoFocus
                    required
                    className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white font-mono text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/40 uppercase tracking-wider"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11.5px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || (method === 'password' && !password) || (method === 'recovery_key' && !recoveryKey.trim())}
              className="flex-1 h-9 rounded-xl bg-white hover:bg-neutral-200 text-black text-[13px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>{isVerifying ? 'Verifying...' : 'Continue'}</span>
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // Step 2: Kaboom confirmation modal
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kaboom">
      <div className="flex flex-col gap-4">
        <div className="p-3.5 rounded-xl bg-[#48484C]/50 border border-white/10 text-white/90 text-[13px] leading-relaxed">
          This wipes your vault, saved identities, and inboxes. Local only — nothing was backed up anywhere.
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11.5px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteKaboom}
            disabled={isClearing}
            className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearing ? 'Wiping...' : 'Kaboom!'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
