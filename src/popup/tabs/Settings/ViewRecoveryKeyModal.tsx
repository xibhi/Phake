import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, AlertCircle, Copy, Check, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';

interface ViewRecoveryKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ViewRecoveryKeyModal: React.FC<ViewRecoveryKeyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const getDecryptedRecoveryKey = useStore((s) => s.getDecryptedRecoveryKey);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setIsVerifying(false);
      setError(null);
      setRevealedKey(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your master password.');
      return;
    }

    setIsVerifying(true);
    const key = await getDecryptedRecoveryKey(password);
    setIsVerifying(false);

    if (key) {
      setRevealedKey(key);
      setError(null);
    } else {
      setError('Incorrect master password. Access denied.');
    }
  };

  const handleCopy = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Secret Recovery Key">
      {!revealedKey ? (
        <form onSubmit={handleVerify} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-[#8E8E93] text-[12px] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <span>
              Enter your master password to decrypt and view your Secret Recovery Key.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Master Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password..."
                autoFocus
                required
                className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13.5px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors placeholder:text-white/50 shadow-sm"
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

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
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
              disabled={isVerifying || !password}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
            >
              {isVerifying ? 'Verifying...' : 'Reveal Key'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11.5px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Never share this key with anyone. It grants full access to recover and reset your vault credentials.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#8E8E93]">Your Secret Recovery Key</label>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#48484C] border border-white/20 shadow-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <KeyRound className="w-4 h-4 text-white/70 shrink-0" />
                <span className="text-[13px] font-mono font-bold text-white tracking-wider truncate select-all">
                  {revealedKey}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11.5px] font-semibold text-white transition-colors cursor-pointer shrink-0 shadow-sm"
                title="Copy Secret Key"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

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
