'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import { GooMenuItem } from '@/components/motion/goo-popover/menu';
import type { TableMenuItem } from './types';

/**
 * Satır/kolon "…" menüsü — beui'nin portal menüsü yerine ev goo paneli
 * (DESIGN.md §5 "Goo açılır panel": hairline + shadow-md katman istisnası,
 * yıkıcı öğe `text-destructive`). Tetikleyici ve panel satır tıklamasını yutar
 * (panel portallı ama React olayı satıra kabarır); `RowActions` açıkken görünür
 * kalır (`data-state=open`).
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
    <GooPopover align={align} dismiss="consume">
      <GooPopoverTrigger>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={ariaLabel}
          className={triggerClassName}
          onClick={e => e.stopPropagation()}
        >
          {trigger ?? <MoreHorizontal aria-hidden />}
        </Button>
      </GooPopoverTrigger>
      <GooPopoverContent aria-label={ariaLabel} className="min-w-[8rem] p-1" onClick={e => e.stopPropagation()}>
        {items.map(item => (
          <GooMenuItem
            key={item.label}
            variant={item.destructive ? 'destructive' : 'default'}
            disabled={item.disabled}
            onSelect={item.onSelect}
          >
            {item.icon}
            {item.label}
          </GooMenuItem>
        ))}
      </GooPopoverContent>
    </GooPopover>
  );
}
