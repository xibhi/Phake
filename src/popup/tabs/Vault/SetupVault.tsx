import React, { useState, useMemo } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle, KeyRound, Copy, Check } from 'lucide-react';
import { evaluatePasswordStrength, generateSecretRecoveryKey } from '../../../lib/crypto';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';

interface SetupVaultProps {
  onSetup: (password: string, recoveryKey: string) => Promise<boolean>;
  error: string | null;
}

export const SetupVault: React.FC<SetupVaultProps> = ({ onSetup, error }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate a unique 24-character Secret Recovery Key for this vault setup
  const secretRecoveryKey = useMemo(() => generateSecretRecoveryKey(), []);

  const strength = evaluatePasswordStrength(password);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretRecoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    await onSetup(password, secretRecoveryKey);
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-card-gap p-4">
      <div className="flex flex-col items-center text-center py-3">
        <div className="w-12 h-12 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-3 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-[17px] font-bold text-white tracking-tight">
          Create Master Password
        </h2>
        <p className="text-[12px] text-[#8E8E93] max-w-[280px] mt-1 leading-relaxed">
          Local encryption with Secret Recovery Key.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-card-gap">
        <div>
          <SectionHeader title="Password" />
          <Card className="divide-y divide-white/5">
            {/* Password Input */}
            <div className="py-2.5 px-3.5 flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#8E8E93]">Master Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters..."
                  required
                  className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13.5px] rounded-xl px-3 py-2 pr-10 focus:outline-none transition-colors shadow-sm"
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
              {password.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8E8E93]">Strength:</span>
                    <span style={{ color: strength.color }} className="font-semibold">
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex gap-1 h-1.5 w-full bg-[#48484C] rounded-full overflow-hidden">
                    {[0, 1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className="flex-1 h-full rounded-full transition-colors"
                        style={{
                          backgroundColor:
                            step <= strength.score ? strength.color : 'rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="py-2.5 px-3.5 flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#8E8E93]">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                required
                className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13.5px] rounded-xl px-3 py-2 focus:outline-none transition-colors shadow-sm"
              />
            </div>
          </Card>
        </div>

        {/* Secret Recovery Key Section */}
        <div>
          <SectionHeader title="Secret Recovery Key" />
          <Card className="p-3.5 flex flex-col gap-2.5">
            <p className="text-[11.5px] text-[#8E8E93] leading-relaxed">
              Store this secret key safely. It is the only way to recover your vault if you forget your master password.
            </p>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#48484C] border border-white/20 shadow-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <KeyRound className="w-4 h-4 text-white/70 shrink-0" />
                <span className="text-[13px] font-mono font-bold text-white tracking-wider truncate select-all">
                  {secretRecoveryKey}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
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
          </Card>
        </div>

        {(validationError || error) && (
          <div className="flex items-center gap-2 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError || error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || password.length < 8}
          className="w-full h-11 rounded-[14px] bg-white text-black hover:bg-neutral-200 font-bold text-[14.5px] shadow-md transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>{isSubmitting ? 'Creating Vault...' : 'Create Vault'}</span>
        </button>
      </form>
    </div>
  );
};
