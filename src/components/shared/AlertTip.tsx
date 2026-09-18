'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Tooltip, TooltipContent } from '@/components/animate-ui/components/animate/tooltip';
import { useGlobalTooltip, useTooltip } from '@/components/animate-ui/primitives/animate/tooltip';
import { cn } from '@/lib/utils';

interface AlertTipProps {
  /** Balon görünür mü — hover değil, çağıran taraf sürer (ör. boş form gönderimi). */
  open: boolean;
  /** Balonda gösterilen uyarı metni. */
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Balonun oklandığı eleman. */
  children: ReactNode;
  className?: string;
}

/**
 * Uyarı balonu — `InfoTip` ile aynı primitif ve aynı görünüm (animate-ui
 * Tooltip: ink zemin, oklu), ama hover yerine `open` prop'uyla açılır.
 * Tarayıcının yerel doğrulama balonunun yerine geçer (DESIGN.md §5 "Bilgi
 * balonu" dili). Sağlayıcı SidebarProvider'dan gelir; balon
 * `pointer-events-none` olduğundan Popover içinde "dışarı tıklama" sayılmaz.
 */
export function AlertTip({ open, text, side = 'top', children, className }: AlertTipProps) {
  return (
    <Tooltip side={side} align="center">
      <AlertTipAnchor open={open} className={className}>
        {children}
      </AlertTipAnchor>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

/**
 * `TooltipTrigger`'ın hover/focus dinleyicileri olmadan aynı işi yapar:
 * çapa elemanının rect'ini global sağlayıcıya verip balonu açar/kapatır.
 */
function AlertTipAnchor({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const local = useTooltip();
  const global = useGlobalTooltip();

  // showTooltip/currentTooltip her render'da kimlik değiştirir; effect yalnız
  // `open`'a bağlı kalsın diye güncel değerler ref'te taşınır.
  const latest = useRef({ local, global });
  latest.current = { local, global };

  useEffect(() => {
    const { local: l, global: g } = latest.current;
    if (open) {
      const el = anchorRef.current;
      if (!el) return;
      g.setReferenceEl(el);
      g.showTooltip({
        contentProps: l.props,
        contentAsChild: l.asChild,
        rect: el.getBoundingClientRect(),
        side: l.side,
        sideOffset: l.sideOffset,
        align: l.align,
        alignOffset: l.alignOffset,
        id: l.id,
      });
      return;
    }
    if (g.currentTooltip?.id === l.id) g.hideImmediate();
  }, [open]);

  // Unmount'ta (panel kapanırken) açık kalmış balonu bırakma.
  useEffect(
    () => () => {
      const { local: l, global: g } = latest.current;
      if (g.currentTooltip?.id === l.id) g.hideImmediate();
    },
    [],
  );

  return (
    <span ref={anchorRef} className={cn('inline-flex', className)}>
      {children}
    </span>
  );
}
