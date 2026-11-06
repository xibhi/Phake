import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Mail,
  ExternalLink,
  Save,
  Globe,
} from 'lucide-react';
import { VaultEntry } from '../../../lib/types';
import { useStore, formatSiteName } from '../../store/useStore';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { AuthVerificationModal } from '../../components/AuthVerificationModal';

interface CredentialDetailProps {
  entry: VaultEntry;
  credentialBadge?: string | null;
  onBack: () => void;
  onRequestDelete?: (id: string, name: string) => void;
}

export const CredentialDetail: React.FC<CredentialDetailProps> = ({
  entry,
  credentialBadge,
  onBack,
  onRequestDelete,
}) => {
  const addOrUpdateVaultEntry = useStore((s) => s.addOrUpdateVaultEntry);
  const deleteVaultEntry = useStore((s) => s.deleteVaultEntry);
  const openMailboxByAddress = useStore((s) => s.openMailboxByAddress);

  const [fields, setFields] = useState<Record<string, string>>({ ...entry.fields });
  const [siteName, setSiteName] = useState(entry.siteName || formatSiteName(entry.hostname, entry.siteName));
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setSiteName(entry.siteName || formatSiteName(entry.hostname, entry.siteName));
    setFields({ ...entry.fields });
  }, [entry]);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFieldChange = (key: string, val: string) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    setIsSaved(false);
  };

  const handleSave = async (overrideName?: string) => {
    const finalName = (overrideName !== undefined ? overrideName : siteName).trim();
    const resolvedName = finalName || formatSiteName(entry.hostname);
    setSiteName(resolvedName);
    const updated: VaultEntry = {
      ...entry,
      siteName: resolvedName,
      fields,
      lastUsedAt: Date.now(),
    };
    await addOrUpdateVaultEntry(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDeleteTrigger = () => {
    if (onRequestDelete) {
      onRequestDelete(entry.id, siteName);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleConfirmedDelete = async () => {
    await deleteVaultEntry(entry.id);
    setShowAuthModal(false);
    onBack();
  };

  const emailField = Object.entries(fields).find(([k]) =>
    /email|mail/i.test(k)
  )?.[1] || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.primaryIdentifier) ? entry.primaryIdentifier : null);

  return (
    <div className="flex flex-col gap-card-gap p-4 animate-fade-in">
      {/* Top Bar with Back Chevron & Delete */}
      <div className="flex items-center justify-between pb-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-[#8E8E93] hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Vault</span>
        </button>

        <button
          onClick={handleDeleteTrigger}
          className="w-7 h-7 rounded-full bg-[#48484C] hover:bg-red-500/20 border border-white/20 flex items-center justify-center text-white/80 hover:text-red-400 transition-colors cursor-pointer shadow-sm"
          title="Delete Entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Site Header Card */}
      <Card className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#48484C] border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
            {entry.faviconUrl ? (
              <img
                src={entry.faviconUrl}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe className="w-5 h-5 text-white/70" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <input
              type="text"
              value={siteName}
              onChange={(e) => {
                setSiteName(e.target.value);
                setIsSaved(false);
              }}
              onBlur={() => handleSave(siteName)}
              placeholder="Site Name"
              className="bg-transparent text-[15px] font-bold text-white focus:outline-none focus:border-b border-white/40 truncate w-full min-w-0"
            />
            <a
              href={entry.url || `https://${entry.hostname}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-[#8E8E93] hover:text-white flex items-center gap-1 truncate mt-0.5"
            >
              <span className="truncate">{entry.hostname}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {credentialBadge && (
          <span className="px-2.5 py-1 rounded-full bg-[#525258] border border-white/25 text-white text-[11px] font-bold tracking-tight shrink-0 whitespace-nowrap shadow-sm">
            {credentialBadge}
          </span>
        )}
      </Card>

      {/* Prominent Shortcut to Mailbox at TOP */}
      {emailField && (
        <button
          onClick={() => openMailboxByAddress(emailField, entry.primaryIdentifier, entry.hostname)}
          className="flex items-center justify-between p-3 rounded-[16px] bg-[#2C2C2E] hover:bg-[#38383A] border border-white/15 text-white transition-all shadow-sm group cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="w-8 h-8 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-white leading-tight">
                  Open Mailbox
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#48484C] border border-white/20 text-white/80 text-[9.5px] font-semibold">
                  Inbox
                </span>
              </div>
              <span className="text-[11.5px] text-[#8E8E93] truncate font-mono mt-0.5">
                {emailField}
              </span>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 rotate-180 text-[#8E8E93] group-hover:text-white group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Saved Fields Card */}
      <div>
        <SectionHeader title="Fields" />
        <Card className="divide-y divide-white/5">
          {Object.entries(fields).map(([label, val]) => {
            const isPass = /pass/i.test(label);
            return (
              <div key={label} className="py-2.5 px-3.5 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-[#8E8E93]">{label}</span>
                  <div className="flex items-center gap-1.5">
                    {isPass && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#8E8E93] hover:text-white p-1 focus:outline-none cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(label, val)}
                      className="w-7 h-7 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shadow-sm"
                      title="Copy"
                    >
                      {copiedKey === label ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <input
                  type={isPass && !showPassword ? 'password' : 'text'}
                  value={val}
                  onChange={(e) => handleFieldChange(label, e.target.value)}
                  className="bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] font-mono rounded-xl px-3 py-1.5 focus:outline-none transition-colors shadow-sm"
                />
              </div>
            );
          })}
        </Card>
      </div>

      {/* Save Changes Button */}
      <button
        onClick={() => handleSave()}
        className={`w-full h-10 rounded-[14px] font-bold text-[13.5px] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
          isSaved
            ? 'bg-emerald-500 text-black'
            : 'bg-white text-black hover:bg-neutral-200 active:scale-[0.99]'
        }`}
      >
        {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
        <span>{isSaved ? 'Saved' : 'Save'}</span>
      </button>

      {/* Metadata */}
      <div className="text-center text-[10.5px] text-[#8E8E93] py-1">
        Created {new Date(entry.createdAt).toLocaleDateString()} • Used{' '}
        {new Date(entry.lastUsedAt).toLocaleDateString()}
      </div>

      {/* Auth Verification Modal if triggered directly */}
      <AuthVerificationModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onVerified={handleConfirmedDelete}
        title="Delete Credential"
        description={`Delete credentials for "${siteName}".`}
        confirmButtonText="Delete"
        isDestructive={true}
      />
    </div>
  );
};
