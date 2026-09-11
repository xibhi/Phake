import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#2E2E2E]/80 backdrop-blur-md border border-white/10 rounded-[16px] overflow-hidden shadow-sm ${onClick ? 'cursor-pointer hover:bg-[#383838]/85 transition-colors' : ''
        } ${className}`}
    >
      {children}
    </div>
  );
};
