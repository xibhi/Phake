import React from 'react';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between px-1 mb-2 ${className}`}>
      <span className="text-[13px] font-bold text-[#8E8E93] tracking-normal">
        {title}
      </span>
      {action && <div className="text-[#8E8E93] hover:text-white transition-colors">{action}</div>}
    </div>
  );
};
