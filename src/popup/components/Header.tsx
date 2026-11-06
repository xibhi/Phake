import React from 'react';
import { X } from 'lucide-react';
import { PHAKE_LOGO_DATA_URI } from '../../lib/logo';

interface HeaderProps {
  subtitle?: string;
  onClose?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  subtitle = 'version 1.0.0',
  onClose,
}) => {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.close();
    }
  };

  return (
    <header
      data-drag-handle="true"
      className="flex items-center justify-between px-4 pt-3.5 pb-2 bg-transparent select-none shrink-0 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        {/* Circular Logo Icon */}
        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
          <img
            src={PHAKE_LOGO_DATA_URI}
            alt="Phake Logo"
            className="w-full h-full object-contain rounded-full select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Title + Subtitle Stack */}
        <div className="flex flex-col">
          <span className="text-[16px] font-bold tracking-tight text-white leading-tight">
            Phake
          </span>
          <span className="text-[12px] font-normal text-[#8E8E93] leading-tight mt-0.5">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Circular Close Button matching Prod */}
      <button
        onClick={handleClose}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/80 hover:text-white transition-all focus:outline-none cursor-pointer"
        title="Close"
        aria-label="Close"
      >
        <X className="w-4 h-4 stroke-[2.2]" />
      </button>
    </header>
  );
};
