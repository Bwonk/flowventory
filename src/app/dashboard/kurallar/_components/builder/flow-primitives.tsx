'use client';

import type { ReactNode } from 'react';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Akış kartı yüzeyi (DESIGN.md §5 "Akış kartları"). */
export const CARD = 'rounded-lg border border-hairline bg-card p-4';

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
