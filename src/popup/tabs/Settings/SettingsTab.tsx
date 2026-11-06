import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Shield,
  KeyRound,
  Trash2,
  ExternalLink,
  Sliders,
  Lock,
  Globe,
  Info,
  Loader2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AutoLockTimeout, DensityMode } from '../../../lib/types';
import { COUNTRY_LIST } from '../../../lib/locales';
import { Card } from '../../components/Card';
import { Row } from '../../components/Row';
import { SectionHeader } from '../../components/SectionHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ClearDataModal } from './ClearDataModal';
import { ViewRecoveryKeyModal } from './ViewRecoveryKeyModal';
import { ExportVaultModal } from './ExportVaultModal';
import { ImportVaultModal } from './ImportVaultModal';

export const SettingsTab: React.FC = () => {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const isVaultInitialized = useStore((s) => s.isVaultInitialized);
  const changeMasterPassword = useStore((s) => s.changeMasterPassword);
  const resetVault = useStore((s) => s.resetVault);
  const vaultError = useStore((s) => s.vaultError);

  const updateInfo = useStore((s) => s.updateInfo);
  const isCheckingUpdate = useStore((s) => s.isCheckingUpdate);
  const checkUpdates = useStore((s) => s.checkUpdates);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRecoveryKeyModalOpen, setIsRecoveryKeyModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleManualCheck = async () => {
    if (isCheckingUpdate || cooldown > 0) return;
    setCooldown(5);
    await checkUpdates(true);
  };

  const handleOpenUpdateUrl = () => {
    const url = updateInfo.updateUrl || 'https://github.com/xibhi/phake';
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDensityChange = (density: DensityMode) => {
    updateSettings({ density });
  };

  const handleCountryChange = (defaultCountry: string) => {
    updateSettings({ defaultCountry });
  };

  const handleAutoLockChange = (val: string) => {
    updateSettings({ autoLockTimeoutMinutes: Number(val) as AutoLockTimeout });
  };

  return (
    <div className="flex flex-col gap-card-gap p-4">
      {/* 1. GENERAL */}
      <div>
        <SectionHeader title="General" />
        <Card>
          {/* Density Row */}
          <Row
            label="Density"
            control={
              <SegmentedControl<DensityMode>
                value={settings.density}
                onChange={handleDensityChange}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            }
          />

          {/* Default Country Selector with #48484C dropdown */}
          <Row
            label="Default Country"
            isLast={true}
            control={
              <div className="relative">
                <select
                  value={settings.defaultCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="appearance-none bg-[#48484C] hover:bg-[#525256] border border-white/20 text-white text-[12.5px] font-medium rounded-full pl-3.5 pr-7 py-1.5 focus:outline-none focus:border-white/50 transition-colors cursor-pointer shadow-sm"
                >
                  {COUNTRY_LIST.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#2E2E2E] text-white">
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/70">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>
            }
          />
        </Card>
      </div>

      {/* 2. SECURITY */}
      <div>
        <SectionHeader title="Security" />
        <Card>
          {/* Auto Lock Timeout with #48484C dropdown */}
          <Row
            label="Auto-Lock"
            control={
              <div className="relative">
                <select
                  value={settings.autoLockTimeoutMinutes}
                  onChange={(e) => handleAutoLockChange(e.target.value)}
                  className="appearance-none bg-[#48484C] hover:bg-[#525256] border border-white/20 text-white text-[12.5px] font-medium rounded-full pl-3.5 pr-7 py-1.5 focus:outline-none focus:border-white/50 transition-colors cursor-pointer shadow-sm"
                >
                  <option value="1" className="bg-[#2E2E2E] text-white">1 Minute</option>
                  <option value="5" className="bg-[#2E2E2E] text-white">5 Minutes</option>
                  <option value="15" className="bg-[#2E2E2E] text-white">15 Minutes</option>
                  <option value="30" className="bg-[#2E2E2E] text-white">30 Minutes</option>
                  <option value="-1" className="bg-[#2E2E2E] text-white">Never</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/70">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>
            }
          />

          {/* Change Master Password Row */}
          <Row
            label="Change Password"
            sublabel={isVaultInitialized ? undefined : 'Set up vault first'}
            disabled={!isVaultInitialized}
            onClick={() => setIsPasswordModalOpen(true)}
            control={<ChevronRight className="w-4 h-4 text-[#8E8E93]" />}
          />

          {/* Secret Recovery Key Row */}
          <Row
            label="Recovery Key"
            sublabel={isVaultInitialized ? 'View secret recovery key' : 'Set up vault first'}
            disabled={!isVaultInitialized}
            onClick={() => setIsRecoveryKeyModalOpen(true)}
            control={<ChevronRight className="w-4 h-4 text-[#8E8E93]" />}
          />

          {/* Clear All Data */}
          <Row
            label="Kaboom"
            sublabel="Wipes everything"
            isLast={true}
            onClick={() => setIsClearModalOpen(true)}
            control={
              <span className="text-[12px] font-semibold text-red-400 hover:text-red-300">
                Kaboom
              </span>
            }
          />
        </Card>
      </div>

      {/* 3. BACKUP & RESTORE */}
      <div>
        <SectionHeader title="Backup & Restore" />
        <Card>
          <Row
            label="Export Vault"
            sublabel={isVaultInitialized ? 'Save encrypted .phake file' : 'Set up vault first'}
            disabled={!isVaultInitialized}
            onClick={() => setIsExportModalOpen(true)}
            control={<ChevronRight className="w-4 h-4 text-[#8E8E93]" />}
          />
          <Row
            label="Import Vault"
            sublabel="Restore from a .phake file"
            isLast={true}
            onClick={() => setIsImportModalOpen(true)}
            control={<ChevronRight className="w-4 h-4 text-[#8E8E93]" />}
          />
        </Card>
      </div>

      {/* 4. ABOUT */}
      <div>
        <SectionHeader title="About" />
        <Card>
          <Row
            label="Version"
            control={<span className="text-[12.5px] font-mono text-[#8E8E93]">v1.0.0</span>}
          />
          <Row
            label="Disposable Email"
            control={<span className="text-[12px] text-[#8E8E93]">Guerrilla Mail</span>}
          />
          <Row
            label="Storage"
            control={
              <span className="text-[12px] text-emerald-400 font-medium">
                100% Local Encrypted
              </span>
            }
          />

          {/* Update Status Row */}
          {isCheckingUpdate ? (
            <Row
              label="Updates"
              control={
                <span className="text-[12px] text-[#8E8E93] flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-white/70" />
                  Checking…
                </span>
              }
            />
          ) : updateInfo.status === 'update_available' ? (
            <Row
              label="Update"
              sublabel="A newer version is available on GitHub."
              onClick={handleOpenUpdateUrl}
              control={<ExternalLink className="w-3.5 h-3.5 text-blue-400" />}
            />
          ) : updateInfo.status === 'failed' ? (
            <Row
              label="Updates"
              control={
                <span className="text-[12px] text-[#8E8E93]">
                  Couldn't check for updates.
                </span>
              }
            />
          ) : (
            <Row
              label="Updates"
              control={<span className="text-[12px] text-[#8E8E93]">Up to date</span>}
            />
          )}

          {/* Manual Check Row */}
          <Row
            label="Check for Update"
            isLast={true}
            disabled={isCheckingUpdate || cooldown > 0}
            onClick={handleManualCheck}
            control={
              <span
                className={`text-[12px] font-medium transition-colors ${
                  isCheckingUpdate || cooldown > 0
                    ? 'text-[#8E8E93]'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                {isCheckingUpdate
                  ? 'Checking…'
                  : cooldown > 0
                  ? `Wait ${cooldown}s`
                  : 'Check now'}
              </span>
            }
          />
        </Card>
      </div>

      {/* Modals */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onChangePassword={changeMasterPassword}
        error={vaultError}
      />

      <ViewRecoveryKeyModal
        isOpen={isRecoveryKeyModalOpen}
        onClose={() => setIsRecoveryKeyModalOpen(false)}
      />

      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={resetVault}
      />

      <ExportVaultModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <ImportVaultModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
