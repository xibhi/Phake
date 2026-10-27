import React from 'react';
import { Wand2, Lock, Mail, Settings } from 'lucide-react';
import { TabId } from '../../lib/types';
import { useStore } from '../store/useStore';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'filler', label: 'Filler', icon: Wand2 },
  { id: 'vault', label: 'Vault', icon: Lock },
  { id: 'inbox', label: 'Inbox', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const BottomNav: React.FC = () => {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const mailboxes = useStore((s) => s.mailboxes);

  // Total unread across mailboxes
  const totalUnread = mailboxes.reduce((acc, m) => acc + (m.unreadCount || 0), 0);

  return (
    <nav className="flex items-center justify-around h-[54px] px-2 bg-[#1C1C1E] border-t border-white/[0.08] select-none shrink-0">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 group outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none cursor-pointer ${
              isActive ? 'text-white font-semibold' : 'text-[#8E8E93] hover:text-white'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className={`w-[18px] h-[18px] ${
                  isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              {item.id === 'inbox' && totalUnread > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <span className="text-[10.5px] tracking-tight mt-0.5 leading-none">
              {item.label}
            </span>

            {/* Subtle Active Indicator Dot */}
            {isActive && (
              <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
