import React, { useState, useEffect } from 'react';
import { Lock, HelpCircle, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { Modal } from './Modal';
import { useStore } from '../store/useStore';

interface AuthVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => Promise<void> | void;
  title: string;
  description?: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
}

export const AuthVerificationModal: React.FC<AuthVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title,
  description,
  confirmButtonText = 'Confirm',
  isDestructive = false,
}) => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const verifyMasterPassword = useStore((s) => s.verifyMasterPassword);
  const verifyRecoveryKey = useStore((s) => s.verifyRecoveryKey);

  const [mode, setMode] = useState<'password' | 'recovery_key'>('password');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('password');
      setPassword('');
      setRecoveryKey('');
      setError(null);
      setShowPassword(false);
      setIsVerifying(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    try {
      if (!isVaultInitialized) {
        // If no master password was set yet, allow action directly
        await onVerified();
        onClose();
        return;
      }

      if (mode === 'password') {
        if (!password) {
          setError('Please enter your master password.');
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

      await onVerified();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {description && (
          <p className="text-[12px] text-[#8E8E93] leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {isVaultInitialized && (
          <div className="flex p-1 rounded-xl bg-[#3A3A3C] border border-white/10 mb-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'password'
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
                setMode('recovery_key');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'recovery_key'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Secret Key</span>
            </button>
          </div>
        )}

        {mode === 'password' ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">
              Password
            </label>

            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password..."
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

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11.5px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isVerifying}
            className={`flex-1 h-9 rounded-xl text-white text-[13px] font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 active:scale-95'
                : 'bg-white !text-black hover:bg-neutral-200 active:scale-95'
            }`}
          >
            {isVerifying ? (
              <span>Verifying...</span>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>{confirmButtonText}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
