import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[344px] max-h-[480px] bg-[#242426] border border-white/20 rounded-[22px] shadow-[0_24px_65px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col animate-scale-up my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#2C2C2E] shrink-0">
          <span className="text-[14px] font-bold text-white tracking-tight truncate pr-2">
            {title}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#48484C] hover:bg-[#58585C] border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all focus:outline-none cursor-pointer shrink-0 active:scale-95 shadow-sm"
            title="Close"
          >
            <X className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 flex flex-col overflow-y-auto max-h-[415px] gap-2.5">
          {children}
        </div>
      </div>
    </div>
  );
};
