'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { TableMenuItem } from './types';

/**
 * Satır/kolon "…" menüsü — beui'nin portal menüsü yerine ev `DropdownMenu`'sü
 * (hairline + shadow-md katman istisnası, yıkıcı öğe `text-destructive`).
 * Tetikleyici satır tıklamasını yutar; `RowActions` açıkken görünür kalır
 * (`data-state=open`).
 */
export function TableMenu({
  items,
  ariaLabel,
  trigger,
  triggerClassName,
  align = 'end',
}: {
  items: TableMenuItem[];
  ariaLabel: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: 'start' | 'end';
}) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={ariaLabel}
          className={triggerClassName}
          onClick={e => e.stopPropagation()}
        >
          {trigger ?? <MoreHorizontal aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={e => e.stopPropagation()}>
        {items.map(item => (
          <DropdownMenuItem
            key={item.label}
            variant={item.destructive ? 'destructive' : 'default'}
            disabled={item.disabled}
            onSelect={item.onSelect}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
