'use client';

import type { ReactNode } from 'react';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@/components/ui/icons/trash';
import { cn } from '@/lib/utils';

/** Akış kartı yüzeyi (DESIGN.md §5 "Akış kartları"). */
/**
 * Kaldır vurgusu: çöp ikonunun üzerindeyken (ya da klavyeyle odaktayken) gidecek
 * şeyin kenarlığı kızarır — kendi çöpünde kartın kendisi, aşama çöpünde
 * (`group/stage`) aşamadaki tüm kutular. `RemoveButton` `data-remove` ile işaretler.
 */
export const REMOVE_HIGHLIGHT_STAGE =
  'transition-colors duration-150 group-has-[[data-remove=stage]:hover]/stage:border-destructive/50 group-has-[[data-remove=stage]:focus-visible]/stage:border-destructive/50';
const REMOVE_HIGHLIGHT_SELF =
  'has-[[data-remove=card]:hover]:border-destructive/50 has-[[data-remove=card]:focus-visible]:border-destructive/50';

export const CARD = `rounded-lg border border-hairline bg-card p-4 ${REMOVE_HIGHLIGHT_SELF} ${REMOVE_HIGHLIGHT_STAGE}`;

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground', className)}>{children}</p>;
}

/** Kartlar arası dikey hairline; etiket verilirse ortasında rozet. */
export function FlowConnector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="h-4 w-px bg-hairline" />
      {label && (
        <>
          <Badge variant="outline" className="font-mono uppercase tracking-wider">
            {label}
          </Badge>
          <span className="h-4 w-px bg-hairline" />
        </>
      )}
    </div>
  );
}

export const DASHED_ADD =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline px-4 py-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-hairline disabled:hover:text-muted-foreground';

export function DashedAddButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  const plus = useIconHover();
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={DASHED_ADD} {...plus.hoverProps}>
      <PlusIcon ref={plus.ref} size={14} className="flex shrink-0" aria-hidden />
      {label}
    </button>
  );
}

/**
 * Akıştaki tek "kaldır" kalıbı (DESIGN.md §5 "Akış kartları"): yalnız çöp ikonu,
 * 28px ghost buton, dinlenirken muted, üzerine gelince `text-destructive`. Yazı
 * yok; ne yapacağını bilgi balonuyla aynı ink balon söyler (`tip` — sonucu da
 * anlatır: "Aşamayı kaldır — koşulları ve aksiyonlarıyla birlikte"). Balon DOM'a
 * basılmadığı için ad `aria-label`'da. Kaldırılan şeyin başlık satırının sağında durur —
 * kart içinde `-mr-2 -mt-2` ile köşeye, kutusuz aşama başlığında `mr-2` ile
 * kartlardaki ikonlarla aynı dikey hizaya oturur.
 */
export function RemoveButton({
  label,
  tip = label,
  scope = 'card',
  onClick,
  className,
}: {
  /** Ekran okuyucu adı (ör. "Koşul 2 kaldır"). */
  label: string;
  /** Balon metni; verilmezse `label`. */
  tip?: string;
  /** Vurgunun kapsamı: kartın kendisi ya da tüm aşama (`REMOVE_HIGHLIGHT_*`). */
  scope?: 'card' | 'stage';
  onClick: () => void;
  className?: string;
}) {
  const trash = useIconHover();
  return (
    <Tooltip side="left" align="center">
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-7 text-muted-foreground hover:text-destructive', className)}
          aria-label={label}
          data-remove={scope}
          onClick={onClick}
          {...trash.hoverProps}
        >
          <TrashIcon ref={trash.ref} size={14} className="flex shrink-0 [&>svg]:size-3.5!" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-balance">{tip}</TooltipContent>
    </Tooltip>
  );
}
