'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface DropdownProps {
  label: React.ReactNode;
  active?: boolean;
  align?: 'start' | 'end';
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

/** Popover/Select yerine kullanılan hafif özel dropdown (useState + absolute konum). */
export const Dropdown: React.FC<DropdownProps> = ({ label, active, align = 'start', panelClassName, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${
          active
            ? 'bg-[#eeece7] font-medium text-[#17171c]'
            : 'text-[#75758a] hover:bg-[#f2f2f2] hover:text-[#17171c]'
        }`}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute z-50 mt-2 min-w-[200px] rounded-[12px] border border-[#e5e7eb] bg-[#ffffff] p-1.5 shadow-[0_10px_30px_rgba(23,23,28,0.10)] ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${panelClassName ?? ''}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

export const OptionButton: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({
  label,
  selected,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] text-[#17171c] transition-colors hover:bg-[#f2f2f2]"
  >
    <span className="truncate">{label}</span>
    {selected && <Check className="h-4 w-4 shrink-0 text-[#1863dc]" />}
  </button>
);
