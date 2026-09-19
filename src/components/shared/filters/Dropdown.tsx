'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { CHECK_ANIMATION_MS, CheckIcon, type CheckIconHandle } from '@/components/ui/icons/check';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DropdownProps {
  label: React.ReactNode;
  active?: boolean;
  /**
   * 'default' serbest duran tetikleyici; 'segment' `ToolTrack` içindeki 30px
   * `bg-card` + hairline hap — aktifken ink metin + nokta (DESIGN.md §5 "Araç yolu").
   */
  variant?: 'default' | 'segment';
  /**
   * `children(close)` çağrısından kapanışa kadar bekleme (ms). Varsayılan tik
   * çizimi süresi — `OptionButton` listeleri için; tik olmayan paneller 0 verir.
   */
  closeDelay?: number;
  align?: 'start' | 'end';
  panelClassName?: string;
  /**
   * Panel tetikleyiciden goo ile akarak açılır (DESIGN.md §5 "Goo açılır panel").
   * Deneme: yalnız Kurallar. İçerikte radix `DropdownMenu*` parçası kullanılamaz.
   */
  goo?: boolean;
  children: (close: () => void) => React.ReactNode;
}

/**
 * Filtre tetikleyicisi: radix DropdownMenu (ya da `goo` ile GooPopover) üzerine ince sarmalayıcı.
 * children(close) sözleşmesi korunur; panel içeriği serbest biçimlidir
 * (OptionButton listesi veya ThresholdControl formu).
 */
export const Dropdown: React.FC<DropdownProps> = ({
  label,
  active,
  variant = 'default',
  closeDelay = CHECK_ANIMATION_MS,
  align = 'start',
  panelClassName,
  goo = false,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Seçim sonrası menü, seçili satırdaki tik çizimini (400ms) bitirip kapanır;
  // reduced-motion'da ya da closeDelay=0'da anında.
  const close = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (reduceMotion || closeDelay <= 0) {
      setOpen(false);
      return;
    }
    closeTimer.current = window.setTimeout(() => setOpen(false), closeDelay);
  };

  const trigger = (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Segment: değer taşıyan bir alan — açık arama hapıyla aynı bg-card +
        // hairline; varsayılan değerde metin muted, aktifken ink + nokta.
        variant === 'segment'
          ? cn(
              'h-[30px] border border-hairline bg-card px-3',
              active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )
          : cn(
              'px-3 py-2',
              active
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            ),
      )}
    >
      {label}
      {variant === 'segment' && active && <span aria-hidden className="size-1.5 rounded-full bg-foreground" />}
      <ChevronDown
        className={cn(
          'transition-transform duration-150',
          variant === 'segment' ? 'size-3.5' : 'size-4',
          open && 'rotate-180',
        )}
      />
    </button>
  );
  const panelClass = cn('min-w-[200px] p-1.5', panelClassName);

  if (goo) {
    return (
      <GooPopover open={open} onOpenChange={setOpen} align={align} dismiss="consume" className="shrink-0">
        <GooPopoverTrigger>{trigger}</GooPopoverTrigger>
        <GooPopoverContent className={panelClass} aria-label={typeof label === 'string' ? label : undefined}>
          {children(close)}
        </GooPopoverContent>
      </GooPopover>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className={cn('rounded-lg border-hairline', panelClass)}>
        {children(close)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Menü seçeneği — seçili satırda ink tik (heroicons-animated `check`): menü açılınca çizilir, satır hover'ında yeniden oynar. */
export const OptionButton: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({
  label,
  selected,
  onClick,
}) => {
  const check = useIconHover<CheckIconHandle>();
  useEffect(() => {
    if (selected) check.ref.current?.startAnimation();
  }, [selected, check.ref]);

  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected}
      {...(selected ? check.hoverProps : {})}
      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="truncate">{label}</span>
      {selected && <CheckIcon ref={check.ref} size={16} className="flex shrink-0 text-foreground" aria-hidden />}
    </button>
  );
};
