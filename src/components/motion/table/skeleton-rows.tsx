import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TableColumn } from './types';
import { alignText, cellPadding, effectiveAlign } from './utils';

/**
 * Tablo içi yükleniyor satırları (DESIGN.md §5): gerçek satırla aynı ritim
 * (`py-2.5` + hairline), ilk kolon thumb + iki satır, sayısal kolonlar sağa
 * yaslı kısa çubuk. Gruptan içerik geçişi tbody'de 200ms; satır başı stagger yok.
 */
export function SkeletonRows<T>({
  count,
  columns,
  selectable,
  cellClassName,
}: {
  count: number;
  columns: TableColumn<T>[];
  selectable: boolean;
  cellClassName?: string;
}) {
  const cell = 'border-b border-border py-2.5 align-middle';
  return (
    <>
      {Array.from({ length: count }, (_, r) => (
        <tr key={r} aria-hidden>
          {selectable ? (
            <td className={cn(cell, 'pl-5 pr-0', cellClassName)}>
              <Skeleton className="size-4 rounded" />
            </td>
          ) : null}
          {columns.map((column, i) => {
            const align = effectiveAlign(column);
            return (
              <td key={column.key} className={cn(cell, cellPadding(columns, i, selectable), alignText(align), cellClassName)}>
                {i === 0 ? (
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-7 rounded" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className={cn('h-3', r % 2 ? 'w-40' : 'w-32')} />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ) : (
                  <Skeleton className={cn('h-3', align === 'right' ? 'ml-auto w-10' : align === 'center' ? 'mx-auto w-8' : 'w-2/3')} />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
