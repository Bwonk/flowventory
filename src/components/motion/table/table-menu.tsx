'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
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
          <MenuRow key={item.label} item={item} />
        ))}
      </GooPopoverContent>
    </GooPopover>
  );
}

/** Tek menü öğesi — animasyonlu ikonun hover'ı öğeden sürülür (DESIGN.md §6). */
function MenuRow({ item }: { item: TableMenuItem }) {
  const { ref, hoverProps } = useIconHover();
  const Animated = item.animatedIcon;
  return (
    <GooMenuItem
      variant={item.destructive ? 'destructive' : 'default'}
      disabled={item.disabled}
      onSelect={item.onSelect}
      {...hoverProps}
    >
      {Animated ? <Animated ref={ref} size={14} className="flex shrink-0 [&>svg]:size-3.5!" aria-hidden /> : item.icon}
      {item.label}
    </GooMenuItem>
  );
}
