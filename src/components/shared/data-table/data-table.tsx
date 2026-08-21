import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Kanonik tablo primitifleri — analiz/rapor sayfalarının data-ink dialekti.
 * Yapı/tipografi/etkileşim burada; kolonlar ve hücre içerikleri sayfada kalır.
 */

type Align = 'left' | 'right' | 'center';

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function DataTableHeaderRow({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
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

interface DataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  /** Satıra bağlı bir yükleme sürerken hafif soluklaştırma. */
  pending?: boolean;
  className?: string;
}

export function DataTableRow({ children, onClick, pending, className }: DataTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-border transition-colors last:border-b-0',
        onClick && 'cursor-pointer hover:bg-muted/40',
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
