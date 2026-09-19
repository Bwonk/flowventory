'use client';
// Goo panel içi eylem menüsü parçaları — `ui/dropdown-menu` öğeleriyle aynı görünüm
// (radix menü context'i goo panelde yok). DESIGN.md §5 "Goo açılır panel".

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { useGooPopoverClose } from './index';

interface GooMenuItemProps extends Omit<ComponentProps<'button'>, 'onSelect'> {
  /** Seçilince çağrılır; ardından panel kapanır. */
  onSelect: () => void;
  /** Yıkıcı eylem: `text-destructive`, zemin boyanmaz (DESIGN.md §5). */
  variant?: 'default' | 'destructive';
}

/** Eylem öğesi: seçilince paneli kapatır. ↑/↓ ve Tab gezinmesi panelden gelir. */
export function GooMenuItem({ className, onSelect, variant = 'default', ...props }: GooMenuItemProps) {
  const close = useGooPopoverClose();
  return (
    <button
      type="button"
      onClick={() => {
        onSelect();
        close();
      }}
      className={cn(
        "flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-popover-foreground outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        variant === 'destructive' &&
          'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 [&_svg]:text-destructive!',
        className,
      )}
      {...props}
    />
  );
}

export function GooMenuLabel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-2 py-1.5 text-sm font-medium', className)} {...props} />;
}

export function GooMenuSeparator({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
