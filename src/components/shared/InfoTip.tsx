'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { InformationCircleIcon } from '@/components/ui/icons/information-circle';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { PRESS_FEEDBACK_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface InfoTipProps {
  /** Balonda gösterilen metin — hesabın neye dayandığı, ne zaman üretildiği vb. */
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** `md` başlık yanı (24px buton / 16px ikon), `sm` satır içi (16px / 12px). */
  size?: 'sm' | 'md';
  /** Ekran okuyucu etiketi öneki; balon DOM'a basılmadığı için metin aria-label'da taşınır. */
  ariaPrefix?: string;
  className?: string;
}

/**
 * Bilgi balonu — yardımcı hesap açıklamaları metne değil buraya gider
 * (DESIGN.md §5 "Bilgi balonu"). Balon sidebar'ın kapalı-hal tooltip'iyle
 * aynı primitif (animate-ui Tooltip — ink zemin, oklu); ikon animasyonu
 * butondan sürülür (DESIGN.md §6). Sağlayıcı SidebarProvider'dan gelir.
 * Balon `pointer-events-none` (primitif düzeyinde): Popover/Dialog içinde
 * "dışarı tıklama" sayılmaz.
 */
export function InfoTip({ text, side = 'right', size = 'md', ariaPrefix = 'Bilgi', className }: InfoTipProps) {
  const { ref, hoverProps } = useIconHover();
  const small = size === 'sm';

  return (
    <Tooltip side={side} align="center">
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${ariaPrefix}: ${text}`}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            small ? 'size-4' : 'size-6',
            className,
            PRESS_FEEDBACK_CLASS,
          )}
          {...hoverProps}
        >
          <InformationCircleIcon ref={ref} size={small ? 12 : 16} className="flex" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}
