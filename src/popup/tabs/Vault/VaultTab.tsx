import React, { useMemo, useState } from 'react';
import {
  Lock,
  Search,
  ChevronRight,
  Globe,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { useStore, normalizeHost, formatSiteName } from '../../store/useStore';
import { SetupVault } from './SetupVault';
import { UnlockVault } from './UnlockVault';
import { CredentialDetail } from './CredentialDetail';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { VaultEntry } from '../../../lib/types';
import { AuthVerificationModal } from '../../components/AuthVerificationModal';

export const VaultTab: React.FC = () => {
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const isVaultUnlocked = useStore((s) => s.isVaultUnlocked);
  const vaultEntries = useStore((s) => s.vaultEntries);
  const selectedVaultEntry = useStore((s) => s.selectedVaultEntry);
  const vaultSearchQuery = useStore((s) => s.vaultSearchQuery);
  const vaultError = useStore((s) => s.vaultError);
  const setVaultSearchQuery = useStore((s) => s.setVaultSearchQuery);
  const setSelectedVaultEntry = useStore((s) => s.setSelectedVaultEntry);
  const setupVault = useStore((s) => s.setupVault);
  const unlockVault = useStore((s) => s.unlockVault);
  const lockVault = useStore((s) => s.lockVault);
  const resetVault = useStore((s) => s.resetVault);
  const deleteVaultEntry = useStore((s) => s.deleteVaultEntry);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Group entries by normalized host and sort each site's credentials chronologically (oldest first)
  const hostGroups = useMemo(() => {
    const map = new Map<string, VaultEntry[]>();
    vaultEntries.forEach((entry) => {
      const key = normalizeHost(entry.hostname);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    });

    map.forEach((list) => {
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    });

    return map;
  }, [vaultEntries]);

  const getCredentialBadge = (entry: VaultEntry): string | null => {
    const key = normalizeHost(entry.hostname);
    const sameSiteList = hostGroups.get(key) || [];

    if (sameSiteList.length <= 1) {
      return null;
    }

    const index = sameSiteList.findIndex((e) => e.id === entry.id);
    return index >= 0 ? `Credential ${index + 1}` : null;
  };

  const handleDeleteRequest = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteVaultEntry(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedVaultEntry(null);
    }
  };

  if (!isVaultInitialized) {
    return (
      <SetupVault
        onSetup={setupVault}
        error={vaultError}
      />
    );
  }

  if (isVaultInitialized && !isVaultUnlocked) {
    return (
      <UnlockVault
        onUnlock={unlockVault}
        onReset={resetVault}
        error={vaultError}
      />
    );
  }

  const filteredEntries = vaultEntries.filter((e) => {
    const q = vaultSearchQuery.toLowerCase();
    const site = formatSiteName(e.hostname, e.siteName).toLowerCase();
    const host = (e.hostname || '').toLowerCase();
    const ident = (e.primaryIdentifier || '').toLowerCase();
    const badge = (getCredentialBadge(e) || '').toLowerCase();
    return site.includes(q) || host.includes(q) || ident.includes(q) || badge.includes(q);
  });

  return (
    <div className="flex flex-col gap-card-gap p-4">
      {selectedVaultEntry ? (
        <CredentialDetail
          entry={selectedVaultEntry}
          credentialBadge={getCredentialBadge(selectedVaultEntry)}
          onBack={() => setSelectedVaultEntry(null)}
          onRequestDelete={(id, name) => setDeleteTarget({ id, name })}
        />
      ) : (
        <>
          {/* Top Header Actions */}
          <div className="flex items-center justify-between">
            <SectionHeader title="Credentials" className="!mb-0" />
            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#48484C] hover:bg-[#58585C] active:scale-95 border border-white/20 text-[11.5px] font-semibold text-white transition-all focus:outline-none cursor-pointer shadow-sm"
              title="Lock Vault"
            >
              <Lock className="w-3.5 h-3.5 text-white/90" />
              <span>Lock</span>
            </button>
          </div>

          {/* Search Input Bar with #48484C background */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-white/60 pointer-events-none" />
            <input
              type="text"
              value={vaultSearchQuery}
              onChange={(e) => setVaultSearchQuery(e.target.value)}
              placeholder="Search credentials..."
              className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] rounded-xl pl-9 pr-3 py-2 focus:outline-none transition-colors placeholder:text-white/60 shadow-sm"
            />
          </div>

          {/* Credentials List */}
          <div>
            <SectionHeader
              title={`Vault (${filteredEntries.length})`}
            />

            {filteredEntries.length === 0 ? (
              <Card className="p-6 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-[#48484C] border border-white/20 flex items-center justify-center mb-2.5 shadow-sm">
                  <KeyRound className="w-5 h-5 text-white/70" />
                </div>
                <span className="text-[13.5px] font-semibold text-white">
                  {vaultSearchQuery ? 'No matches' : 'No credentials'}
                </span>
                <p className="text-[11.5px] text-[#8E8E93] max-w-[240px] mt-1 leading-relaxed">
                  {vaultSearchQuery
                    ? 'Try a different search term.'
                    : 'Saved credentials will appear here.'}
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-white/5">
                {filteredEntries.map((entry) => {
                  const displaySiteName = formatSiteName(entry.hostname, entry.siteName);
                  const badge = getCredentialBadge(entry);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedVaultEntry(entry)}
                      className="flex items-center justify-between py-row-py px-row-px hover:bg-white/[0.04] active:opacity-80 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        {/* Favicon Logo with #48484C container */}
                        <div className="w-9 h-9 rounded-xl bg-[#48484C] border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
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
                            <Globe className="w-4 h-4 text-white/70" />
                          )}
                        </div>

                        {/* Site Name + Optional Credential Badge */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px] font-bold text-white truncate">
                              {displaySiteName}
                            </span>
                            {badge && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#525258] border border-white/25 text-white text-[10px] font-bold tracking-tight shrink-0 whitespace-nowrap shadow-sm">
                                {badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11.5px] text-[#8E8E93] truncate font-mono mt-0.5">
                            {entry.primaryIdentifier}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => handleDeleteRequest(e, entry.id, displaySiteName)}
                          className="w-7 h-7 rounded-full bg-[#48484C] border border-white/20 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-white/80 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-sm"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </>
      )}

      {/* Auth Verification Modal for Credential Deletion */}
      <AuthVerificationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onVerified={handleConfirmDelete}
        title="Delete Credential"
        description={`Delete credentials for "${deleteTarget?.name && deleteTarget.name.length > 25 ? deleteTarget.name.slice(0, 25) + '...' : deleteTarget?.name}".`}
        confirmButtonText="Delete"
        isDestructive={true}
      />
    </div>
  );
};
