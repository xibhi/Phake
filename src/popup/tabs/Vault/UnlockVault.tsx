import React, { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, AlertCircle, KeyRound, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';

interface UnlockVaultProps {
  onUnlock: (password: string) => Promise<boolean>;
  onReset: () => Promise<void>;
  error: string | null;
}

export const UnlockVault: React.FC<UnlockVaultProps> = ({ onUnlock, error }) => {
  const recoverVaultWithKey = useStore((s) => s.recoverVaultWithKey);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Recovery modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmNewMasterPassword, setConfirmNewMasterPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsUnlocking(true);
    await onUnlock(password);
    setIsUnlocking(false);
  };

  const handleExecuteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    if (!recoveryKey.trim()) {
      setRecoveryError('Please enter your Secret Recovery Key.');
      return;
    }

    if (newMasterPassword.length < 8) {
      setRecoveryError('New master password must be at least 8 characters long.');
      return;
    }

    if (newMasterPassword !== confirmNewMasterPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setIsRecovering(true);
    const success = await recoverVaultWithKey(recoveryKey.trim(), newMasterPassword);
    setIsRecovering(false);

    if (success) {
      setShowRecoveryModal(false);
      setRecoveryKey('');
      setNewMasterPassword('');
      setConfirmNewMasterPassword('');
    } else {
      setRecoveryError('Incorrect Secret Recovery Key. Please check and try again.');
    }
  };

  return (
    <div className="flex flex-col gap-card-gap p-4">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-3 shadow-sm">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-[17px] font-bold text-white tracking-tight">
          Vault Locked
        </h2>
        <p className="text-[12px] text-[#8E8E93] max-w-[260px] mt-1 leading-relaxed">
          Enter your master password to unlock.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-card-gap">
        <div>
          <SectionHeader title="Password" />
          <Card>
            <div className="py-2.5 px-3.5 flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#8E8E93]">Master Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password..."
                  autoFocus
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13.5px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors placeholder:text-white/60 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isUnlocking || !password}
          className="w-full h-11 rounded-[14px] bg-white text-black hover:bg-neutral-200 font-bold text-[14.5px] shadow-md transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Unlock className="w-4 h-4" />
          <span>{isUnlocking ? 'Unlocking...' : 'Unlock'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowRecoveryModal(true);
            setRecoveryError(null);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
          }}
          className="text-[12px] text-[#8E8E93] hover:text-white transition-colors text-center py-2 focus:outline-none cursor-pointer flex items-center justify-center gap-1"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Forgot password?</span>
        </button>
      </form>

      {/* Secret Key Account Recovery Modal */}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => {
          setShowRecoveryModal(false);
          setShowNewPassword(false);
          setShowConfirmPassword(false);
        }}
        title="Account Recovery"
      >
        <form onSubmit={handleExecuteRecovery} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11.5px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Enter your Secret Recovery Key provided during vault creation to reset your password.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[#8E8E93] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-white/70" />
              <span>Secret Recovery Key</span>
            </label>
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

          <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[#8E8E93]">New Master Password</label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newMasterPassword}
                  onChange={(e) => setNewMasterPassword(e.target.value)}
                  placeholder="At least 8 characters..."
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[#8E8E93]">Confirm Password</label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmNewMasterPassword}
                  onChange={(e) => setConfirmNewMasterPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 text-white/70 hover:text-white focus:outline-none cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                setShowRecoveryModal(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
              }}
              className="flex-1 h-9 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-white/80 hover:text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRecovering || !recoveryKey.trim() || newMasterPassword.length < 8}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isRecovering ? 'Resetting...' : 'Reset & Unlock'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
