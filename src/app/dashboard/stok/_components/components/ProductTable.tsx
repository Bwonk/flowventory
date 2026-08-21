'use client';

import React from 'react';
import type { ProductRow } from '@/lib/products/types';
import { CategoryBadge } from '@/components/shared/badges/CategoryBadge';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import {
  DataTable,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from '@/components/shared/data-table/data-table';
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
}

/** Ürün tablosu — kanonik data-ink düzeni, sonsuz kaydırmalı. */
export const ProductTable: React.FC<ProductTableProps> = ({
  rows,
  hasActiveFilters,
  onClearFilters,
  onSelectProduct,
  hasMore,
  onLoadMore,
  loadingMore,
}) => {
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
      <DataTable>
        <DataTableHeaderRow>
          <DataTableHeadCell edge align="center" className="w-[48px]">#</DataTableHeadCell>
          <DataTableHeadCell>Ürün</DataTableHeadCell>
          <DataTableHeadCell>Durum</DataTableHeadCell>
          <DataTableHeadCell align="right">Görüntülenme</DataTableHeadCell>
          <DataTableHeadCell align="right">Stok Ömrü</DataTableHeadCell>
          <DataTableHeadCell align="right" edge>Toplam Stok</DataTableHeadCell>
        </DataTableHeaderRow>
        <tbody>
          {rows.map((row, rowIndex) => (
            <DataTableRow key={row.productId} onClick={() => onSelectProduct(row.productId)}>
              <DataTableCell edge align="center" className="w-[48px]">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {String(rowIndex + 1).padStart(2, '0')}
                </span>
              </DataTableCell>
              <DataTableCell>
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
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={row.status} size="sm" />
              </DataTableCell>
              <DataTableCell numeric>
                {row.viewCount != null ? row.viewCount : <span className="text-muted-foreground">—</span>}
              </DataTableCell>
              <DataTableCell align="right">
                {row.totalStock === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <StockLifeBadge days={row.daysRemaining ?? null} />
                )}
              </DataTableCell>
              <DataTableCell numeric edge className="font-medium">
                <span className={row.totalStock === 0 ? 'text-status-critical' : 'text-foreground'}>
                  {row.totalStock}
                </span>
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTable>

      <InfiniteScrollFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} itemCount={rows.length} />
    </>
  );
};
