'use client';

import React, { useCallback, useMemo } from 'react';
import type { ProductRow, SortBy } from '@/lib/products/types';
import { CategoryBadge } from '@/components/shared/badges/CategoryBadge';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { Table, type SortDirection, type SortState, type TableColumn } from '@/components/motion/table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { InfiniteScrollFooter } from '@/components/shared/data-table/InfiniteScrollFooter';
import { ProductThumb } from '@/components/shared/filters/atoms';

interface ProductTableProps {
  rows: ProductRow[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSelectProduct: (productId: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  sortBy: SortBy;
  sortReversed: boolean;
  onSortBy: (value: SortBy) => void;
  onToggleSortDirection: () => void;
}

type SortColumn = 'name' | 'status' | 'stockLife' | 'stock';

/** Kolon → filtre şeridindeki sıralama seçeneği; başlık ve dropdown aynı state'i sürer. */
const COLUMN_SORT: Record<SortColumn, SortBy> = {
  name: 'isim-az',
  status: 'aciliyet',
  stockLife: 'stok-omru',
  stock: 'stok-azalan',
};

/** Seçeneğin doğal yönü — ok bunu (tersse çevrilmişini) gösterir. */
const NATURAL_DIRECTION: Record<SortBy, SortDirection> = {
  aciliyet: 'asc',
  'stok-omru': 'asc',
  'stok-azalan': 'desc',
  'stok-artan': 'asc',
  'isim-az': 'asc',
};

const COLUMNS: TableColumn<ProductRow>[] = [
  {
    key: 'index',
    header: '#',
    width: '48px',
    align: 'center',
    cell: (_, ctx) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{String(ctx.index + 1).padStart(2, '0')}</span>
    ),
  },
  {
    key: 'name',
    header: 'Ürün',
    sortable: true,
    minWidth: 220,
    cell: row => (
      <div className="flex items-center gap-2.5">
        <ProductThumb src={row.thumbnail} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.productName}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {row.variantCount} varyant
            {row.category && <CategoryBadge name={row.category} />}
          </p>
        </div>
      </div>
    ),
  },
  { key: 'status', header: 'Durum', sortable: true, width: '128px', cell: row => <StatusBadge status={row.status} size="sm" /> },
  {
    key: 'views',
    header: 'Görüntülenme',
    numeric: true,
    width: '128px',
    cell: row => (row.viewCount != null ? row.viewCount : <span className="text-muted-foreground">—</span>),
  },
  {
    key: 'stockLife',
    header: 'Stok Ömrü',
    sortable: true,
    align: 'right',
    width: '120px',
    cell: row =>
      row.totalStock === 0 ? <span className="text-muted-foreground">—</span> : <StockLifeBadge days={row.daysRemaining ?? null} />,
  },
  {
    key: 'stock',
    header: 'Toplam Stok',
    sortable: true,
    defaultDirection: 'desc',
    numeric: true,
    width: '120px',
    cellClassName: 'font-medium',
    cell: row => <span className={row.totalStock === 0 ? 'text-status-critical' : 'text-foreground'}>{row.totalStock}</span>,
  },
];

/** Ürün tablosu — liste kalıbı (DESIGN.md §5), sonsuz kaydırmalı; 80+ satırda sanal liste. */
export const ProductTable: React.FC<ProductTableProps> = ({
  rows,
  hasActiveFilters,
  onClearFilters,
  onSelectProduct,
  hasMore,
  onLoadMore,
  loadingMore,
  sortBy,
  sortReversed,
  onSortBy,
  onToggleSortDirection,
}) => {
  const activeColumn: SortColumn | null =
    sortBy === 'stok-artan'
      ? 'stock'
      : ((Object.keys(COLUMN_SORT) as SortColumn[]).find(col => COLUMN_SORT[col] === sortBy) ?? null);
  const natural = NATURAL_DIRECTION[sortBy];
  const direction: SortDirection = sortReversed ? (natural === 'asc' ? 'desc' : 'asc') : natural;
  const sort = useMemo<SortState | null>(() => (activeColumn ? { key: activeColumn, direction } : null), [activeColumn, direction]);

  // Sıralama hook'ta yaşar: aynı kolona tıklamak yönü çevirir, başka kolon seçeneği değiştirir.
  const handleSortChange = useCallback(
    (next: SortState | null) => {
      if (!next) return;
      const col = next.key as SortColumn;
      if (col === activeColumn) onToggleSortDirection();
      else onSortBy(COLUMN_SORT[col]);
    },
    [activeColumn, onSortBy, onToggleSortDirection],
  );

  if (rows.length === 0 && !loadingMore) {
    return (
      <EmptyState
        message={hasActiveFilters ? 'Seçili filtrelerle eşleşen ürün bulunamadı.' : 'Henüz ürün bulunamadı.'}
        actionLabel={hasActiveFilters ? 'Filtreleri temizle' : undefined}
        onAction={hasActiveFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <>
      <Table
        data={rows}
        columns={COLUMNS}
        getRowId={row => row.productId}
        rowHeight={49}
        onRowClick={row => onSelectProduct(row.productId)}
        sort={sort}
        onSortChange={handleSortChange}
        clientSort={false}
        loading={loadingMore && rows.length === 0}
      />

      <InfiniteScrollFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} itemCount={rows.length} />
    </>
  );
};
