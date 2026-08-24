import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonRowsProps {
  rows?: number;
  /** Kolon başına çubuk genişliği (Tailwind w-*); ilk kolon ürün hücresi kabul edilir. */
  columns?: string[];
  /** 'table' = checkbox + thumb + kolonlar (41px); 'compact' = ikon + üç satır metin (bildirim/sepet). */
  variant?: 'table' | 'compact';
}

/**
 * Yükleniyor durumu (DESIGN.md §5 "Liste kalıbı"): gerçek satırla aynı 41px
 * ritim (py-2.5 + hairline); thumb 28px + iki satır metin. İçerik gelince
 * grup halinde solar — satır başı stagger yok.
 */
export function SkeletonRows({ rows = 6, columns = ['w-14', 'w-10', 'w-16'], variant = 'table' }: SkeletonRowsProps) {
  if (variant === 'compact') {
    return (
      <div aria-hidden className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2.5 px-4 py-3">
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-[41px] items-center gap-3 px-5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="size-7 rounded" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={i % 2 ? 'h-3 w-40' : 'h-3 w-32'} />
            <Skeleton className="h-2.5 w-16" />
          </div>
          {columns.map((w, j) => (
            <Skeleton key={j} className={`h-3 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
