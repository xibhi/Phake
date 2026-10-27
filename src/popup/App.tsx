import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { FillerTab } from './tabs/Filler/FillerTab';
import { VaultTab } from './tabs/Vault/VaultTab';
import { InboxTab } from './tabs/Inbox/InboxTab';
import { SettingsTab } from './tabs/Settings/SettingsTab';

interface AppProps {
  onClose?: () => void;
  isOverlay?: boolean;
}

export const App: React.FC<AppProps> = ({ onClose, isOverlay = false }) => {
  const activeTab = useStore((s) => s.activeTab);
  const settings = useStore((s) => s.settings);
  const initSettings = useStore((s) => s.initSettings);

  useEffect(() => {
    initSettings();
  }, [initSettings]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'filler':
        return <FillerTab />;
      case 'vault':
        return <VaultTab />;
      case 'inbox':
        return <InboxTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <FillerTab />;
    }
  };

  const recordActivity = useStore((s) => s.recordActivity);

  return (
    <div
      data-density={settings.density}
      onPointerDownCapture={() => recordActivity()}
      onKeyDownCapture={() => recordActivity()}
      onScrollCapture={() => recordActivity()}
      className={`w-[380px] h-[590px] flex flex-col bg-[#242424]/90 backdrop-blur-2xl text-white overflow-hidden font-sans select-none ${
        isOverlay
          ? 'rounded-[24px] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] animate-scale-up'
          : 'border-0'
      }`}
    >
      {/* Fixed Top Header with light transparency */}
      <Header onClose={onClose} />

      {/* Scrollable Tab Body */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {renderTabContent()}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
