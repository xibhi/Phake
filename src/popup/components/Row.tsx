import React from 'react';

interface RowProps {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  control?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isLast?: boolean;
  className?: string;
}

export const Row: React.FC<RowProps> = ({
  label,
  sublabel,
  icon,
  control,
  onClick,
  disabled = false,
  isLast = false,
  className = '',
}) => {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`flex items-center justify-between py-row-py px-row-px transition-colors ${
        !isLast ? 'border-b border-white/5' : ''
      } ${
        onClick && !disabled
          ? 'cursor-pointer hover:bg-white/[0.04] active:opacity-80'
          : ''
      } ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        {icon && <div className="text-[#8E8E93] shrink-0">{icon}</div>}
        <div className="flex flex-col min-w-0">
          <span className="text-[14.5px] font-semibold text-white truncate tracking-tight">
            {label}
          </span>
          {sublabel && (
            <span className="text-[11.5px] font-normal text-[#8E8E93] truncate mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {control && (
        <div className="shrink-0 flex items-center justify-end">
          {control}
        </div>
      )}
    </div>
  );
};
