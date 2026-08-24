'use client';

import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Kanonik tablo primitifleri — DESIGN.md §5 "Liste kalıbı". Yapı/tipografi/
 * etkileşim burada; kolonlar ve hücre içerikleri sayfada kalır.
 */

type Align = 'left' | 'right' | 'center';

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  // relative: içerideki mutlak konumlu parçalar (sr-only başlık, sıralama oku,
  // hover aksiyonları) bu kaydırıcıya göre konumlanır — aksi halde en yakın
  // konumlu ata olan sayfa gövdesine göre ölçülüp onu yatayda taşırıyordu.
  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function DataTableHeaderRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead>
      <tr
        className={cn(
          'border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground',
          className,
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

interface DataTableHeadCellProps {
  children?: ReactNode;
  align?: Align;
  /** Kenar kolon (ilk/son) — px-5; diğerleri px-3. */
  edge?: boolean;
  title?: string;
  className?: string;
}

export function DataTableHeadCell({ children, align = 'left', edge, title, className }: DataTableHeadCellProps) {
  return (
    <th
      title={title}
      className={cn(edge ? 'px-5' : 'px-3', 'py-2 font-normal', ALIGN_CLASS[align], className)}
    >
      {children}
    </th>
  );
}

export type SortDirection = 'asc' | 'desc';

interface DataTableSortHeadCellProps<K extends string> extends DataTableHeadCellProps {
  sortKey: K;
  activeKey: K | null;
  direction: SortDirection;
  onSort: (key: K) => void;
}

/**
 * Sıralanabilir başlık: ok pasifte gizli, hover'da yarı, aktifte tam; yön
 * değişince 150ms döner. Ok hücre padding'inin içine mutlak konumlanır —
 * kolon genişliği düz başlıkla aynıdır, hover'da hiçbir şey kaymaz.
 * Sıralanan kolonun hücreleri vurgulanmaz — sinyal başlıkta kalır (data-ink).
 */
export function DataTableSortHeadCell<K extends string>({
  children,
  align = 'left',
  edge,
  title,
  className,
  sortKey,
  activeKey,
  direction,
  onSort,
}: DataTableSortHeadCellProps<K>) {
  const active = activeKey === sortKey;
  return (
    <th
      title={title}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(edge ? 'px-5' : 'px-3', 'py-2 font-normal', ALIGN_CLASS[align], className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        data-active={active}
        data-direction={active ? direction : undefined}
        className="group/sort relative inline-flex items-center rounded-sm font-mono text-[10px] uppercase tracking-wider whitespace-nowrap transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-foreground"
      >
        <span>{children}</span>
        <ChevronUp
          aria-hidden
          className={cn(
            'absolute top-1/2 size-3 -translate-y-1/2 opacity-0 transition-[opacity,transform] duration-150 group-hover/sort:opacity-50 group-data-[active=true]/sort:opacity-100 group-data-[direction=desc]/sort:-translate-y-1/2 group-data-[direction=desc]/sort:rotate-180',
            align === 'right' ? '-left-3.5' : '-right-3.5',
          )}
        />
      </button>
    </th>
  );
}

interface DataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  /** Seçili satır (checkbox/sepet): bg-muted zemin. */
  selected?: boolean;
  /** Satıra bağlı bir yükleme sürerken hafif soluklaştırma. */
  pending?: boolean;
  className?: string;
}

/**
 * Satır: hover bg-muted/40 (150ms), seçili bg-muted, pending opacity-60.
 * `group` — RowActions hover/focus görünürlüğünü buradan alır.
 */
export function DataTableRow({ children, onClick, selected, pending, className }: DataTableRowProps) {
  return (
    <tr
      onClick={onClick}
      data-selected={selected || undefined}
      className={cn(
        'group border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted/40',
        onClick && 'cursor-pointer',
        selected && 'bg-muted',
        pending && 'opacity-60',
        className,
      )}
    >
      {children}
    </tr>
  );
}

interface DataTableCellProps {
  children?: ReactNode;
  align?: Align;
  /** Sayısal hücre: sağa dayalı + tabular-nums. */
  numeric?: boolean;
  edge?: boolean;
  className?: string;
}

export function DataTableCell({ children, align, numeric, edge, className }: DataTableCellProps) {
  return (
    <td
      className={cn(
        edge ? 'px-5' : 'px-3',
        'py-2.5',
        numeric ? 'text-right tabular-nums' : align ? ALIGN_CLASS[align] : undefined,
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Hover'da beliren satır aksiyonları: hücrede yeri hep ayrılıdır (layout
 * kaymaz), satır hover/focus-within'de ve içindeki bir popover açıkken
 * görünür; dokunmatikte (hover:none) kalıcı görünür. DataTableRow'un
 * `group`'una bağlıdır.
 */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
