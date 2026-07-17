'use client';

import React from 'react';
import type { ProductStatus } from '../types';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';

export const VariantCard: React.FC<{
  label: string;
  secondaryText: string;
  status: ProductStatus;
  selected: boolean;
  onClick: () => void;
  tabIndex?: 0 | -1;
  hideBadge?: boolean;
}> = ({ label, secondaryText, status, selected, onClick, tabIndex = 0, hideBadge }) => {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onClick}
      className={cn(
        'relative flex w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-4 text-left transition-colors duration-100',
        'hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        selected ? 'bg-accent' : 'bg-transparent',
        'border-b border-border last:border-b-0'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-sm text-foreground transition-all duration-100',
          selected ? 'font-semibold' : 'font-medium'
        )}>
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondaryText}</p>
      </div>
      {!hideBadge && <StatusBadge status={status} size="sm" showDot />}
      {selected && <Check className="size-4 shrink-0 text-foreground" />}
    </button>
  );
};
