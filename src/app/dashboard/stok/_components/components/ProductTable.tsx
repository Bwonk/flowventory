'use client';

import React from 'react';
import type { ProductRow } from '@/lib/products/types';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
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

/** "Stok Ömrü" hücresi — gün + kademe etiketi (velocity bazlı tahmin). */
function StockLifeCell({ days }: { days: number | null | undefined }) {
  if (days === 0) return <p className="text-sm font-medium text-destructive">Tükendi</p>;
  if (days == null) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">—</p>
        <p className="text-xs text-muted-foreground">Satış yok</p>
      </div>
    );
  }
  if (days <= 7) {
    return (
      <div>
        <p className="text-sm font-medium tabular-nums text-destructive">{days} gün</p>
        <p className="text-xs text-destructive">Kritik</p>
      </div>
    );
  }
  if (days <= 30) {
    return (
      <div>
        <p className="text-sm font-medium tabular-nums text-status-warning">{days} gün</p>
        <p className="text-xs text-status-warning">Yakında biter</p>
      </div>
    );
  }
  if (days > 365) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">365+ gün</p>
        <p className="text-xs text-muted-foreground">Fazla stok</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium tabular-nums text-foreground">{days} gün</p>
      <p className="text-xs text-muted-foreground">Yeterli</p>
    </div>
  );
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
                      {row.category && (
                        <span className="inline-flex rounded-full bg-info px-2 py-px text-[11px] font-medium text-accent-blue">
                          {row.category}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={row.status} size="sm" />
              </DataTableCell>
              <DataTableCell numeric>
                {row.viewCount != null ? (
                  <>
                    {row.viewCount}
                    <span className="ml-1.5 text-xs text-muted-foreground">görüntülenme</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DataTableCell>
              <DataTableCell align="right">
                <div className="inline-block text-right">
                  <StockLifeCell days={row.daysRemaining} />
                </div>
              </DataTableCell>
              <DataTableCell numeric edge className="font-medium">
                <span className={row.totalStock === 0 ? 'text-destructive' : 'text-foreground'}>
                  {row.totalStock}
                </span>
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">adet</span>
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTable>

      <InfiniteScrollFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} itemCount={rows.length} />
    </>
  );
};
