'use client';

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DropdownProps {
  label: React.ReactNode;
  active?: boolean;
  align?: 'start' | 'end';
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

/**
 * Filtre tetikleyicisi: radix DropdownMenu üzerine ince sarmalayıcı.
 * children(close) sözleşmesi korunur; panel içeriği serbest biçimlidir
 * (OptionButton listesi veya ThresholdControl formu).
 */
export const Dropdown: React.FC<DropdownProps> = ({ label, active, align = 'start', panelClassName, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {label}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className={cn('min-w-[200px] rounded-lg border-hairline p-1.5', panelClassName)}
      >
        {children(() => setOpen(false))}
      </DropdownMenuContent>
    </DropdownMenu>
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
    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
  >
    <span className="truncate">{label}</span>
    {selected && <Check className="size-4 shrink-0 text-accent-blue" />}
  </button>
);
