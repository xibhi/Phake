import React, { useState, useEffect } from 'react';
import { Download, Eye, EyeOff, AlertCircle, Check, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store/useStore';

interface ExportVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportVaultModal: React.FC<ExportVaultModalProps> = ({
  isOpen,
  onClose,
}) => {
  const exportPhakeBackup = useStore((s) => s.exportPhakeBackup);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setIsExporting(false);
      setError(null);
      setExportedFilename(null);
    }
  }, [isOpen]);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your master password.');
      return;
    }

    setIsExporting(true);
    const result = await exportPhakeBackup(password);
    setIsExporting(false);

    if (result.success && result.filename) {
      setExportedFilename(result.filename);
      setError(null);
    } else {
      setError(result.error || 'Incorrect master password.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Vault">
      {!exportedFilename ? (
        <form onSubmit={handleExport} className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-[#8E8E93] text-[12px] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <span>
              Enter your master password to export an encrypted <strong>.phake</strong> file.
              The backup is encrypted using your Secret Recovery Key.
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
              disabled={isExporting || !password}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-neutral-200 text-[13px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export Backup'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[12px] leading-relaxed">
            <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold text-white">Export complete!</p>
              <p className="mt-0.5 text-[11.5px] font-mono text-emerald-300">{exportedFilename}</p>
            </div>
          </div>

          <p className="text-[12px] text-[#8E8E93] leading-relaxed px-1">
            Your vault credentials and mailbox records were encrypted and saved. Keep your Secret Recovery Key safe — it is the only way to decrypt this file.
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
