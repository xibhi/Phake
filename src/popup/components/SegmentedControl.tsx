import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex p-0.5 bg-[#48484C] border border-white/20 rounded-full select-none shadow-sm ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full transition-all duration-150 focus:outline-none cursor-pointer ${
              isActive
                ? 'bg-[#5E5E64] text-white shadow-sm font-semibold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
