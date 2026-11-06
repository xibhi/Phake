import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, AlertCircle, Check, Lock, HelpCircle } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { evaluatePasswordStrength } from '../../../lib/crypto';
import { useStore } from '../../store/useStore';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (oldPass: string, newPass: string) => Promise<boolean>;
  error: string | null;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onChangePassword,
  error: propError,
}) => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const recoverVaultWithKey = useStore((s) => s.recoverVaultWithKey);

  const [method, setMethod] = useState<'password' | 'recovery_key'>('password');
  const [oldPass, setOldPass] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMethod('password');
      setOldPass('');
      setRecoveryKey('');
      setNewPass('');
      setConfirmPass('');
      setShowPass(false);
      setValidationError(null);
      setSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const strength = evaluatePasswordStrength(newPass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (newPass.length < 8) {
      setValidationError('New password must be at least 8 characters long.');
      return;
    }

    if (newPass !== confirmPass) {
      setValidationError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    let ok = false;
    if (method === 'password') {
      ok = await onChangePassword(oldPass, newPass);
    } else {
      ok = await recoverVaultWithKey(recoveryKey.trim(), newPass);
    }

    setIsSubmitting(false);

    if (ok) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOldPass('');
        setRecoveryKey('');
        setNewPass('');
        setConfirmPass('');
        onClose();
      }, 1500);
    } else if (method === 'recovery_key') {
      setValidationError('Incorrect Secret Recovery Key.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* 2-Method Tab Switcher */}
        {isVaultInitialized && (
          <div className="flex p-1 rounded-xl bg-[#3A3A3C] border border-white/10 mb-0.5">
            <button
              type="button"
              onClick={() => {
                setMethod('password');
                setValidationError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                method === 'password'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Current Password</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('recovery_key');
                setValidationError(null);
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
        )}

        {method === 'password' ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Current Password</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              placeholder="Current password"
              required
              className="bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Secret Recovery Key</label>
            <input
              type="text"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              required
              className="bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white font-mono text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/40 uppercase tracking-wider"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[#8E8E93]">New Password</label>
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-[#8E8E93] hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
            >
              {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showPass ? 'Hide' : 'Show'}</span>
            </button>
          </div>
          <input
            type={showPass ? 'text' : 'password'}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="At least 8 characters..."
            required
            className="bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
          />
          {newPass.length > 0 && (
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-[#8E8E93]">Strength:</span>
              <span style={{ color: strength.color }} className="font-semibold">
                {strength.label}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#8E8E93]">Confirm Password</label>
          <input
            type={showPass ? 'text' : 'password'}
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Re-enter password..."
            required
            className="bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm placeholder:text-white/50"
          />
        </div>

        {(validationError || propError) && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError || propError}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px]">
            <Check className="w-4 h-4 shrink-0" />
            <span>Password updated</span>
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
            disabled={isSubmitting || success}
            className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSubmitting ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
