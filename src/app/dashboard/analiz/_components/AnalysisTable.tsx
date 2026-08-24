'use client';

import type { InventoryInsightItem } from '@/app/api/insights/inventory/route';
import { SellThroughBadge } from '@/components/shared/badges/SellThroughBadge';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { TrendBadge } from '@/components/shared/badges/TrendBadge';
import {
  DataTable,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableSortHeadCell,
  type SortDirection,
} from '@/components/shared/data-table/data-table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { InfiniteScrollFooter } from '@/components/shared/data-table/InfiniteScrollFooter';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { formatPrice } from '@/lib/currency';
import { formatDateKey } from '@/lib/format';
import { AbcBadge } from '@/components/shared/badges/AbcBadge';
import { type AnalysisMetric, type AnalysisSortBy } from './constants';

interface AnalysisTableProps {
  rows: InventoryInsightItem[];
  windowDays: number;
  metric: AnalysisMetric;
  /** Trend kolonu yalnızca önceki dönem verisi varken (window=30) çizilir. */
  showTrend: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSelectProduct: (productId: string) => void;
  /** Detay verisi çekilirken tıklanan satır (hafif bekleme durumu). */
  pendingProductId: string | null;
  sortBy: AnalysisSortBy;
  sortReversed: boolean;
  onSortBy: (value: AnalysisSortBy) => void;
  onToggleSortDirection: () => void;
}

type SortColumn = 'value' | 'sold' | 'stockLife' | 'capital';

/**
 * "Tükeniş" sütunu metni. Üç ayrı "tarih yok" hâli var ve karıştırılmamalı:
 * stok zaten bitmiş, satış olmadığı için tahmin edilemiyor, tahmin 2 yılın
 * ötesinde (pratikte ölü stok).
 */
function stockoutLabel(item: InventoryInsightItem): string {
  if (item.totalStock === 0) return 'tükendi';
  if (item.daysOfStock === null) return 'satış yok';
  return formatDateKey(item.stockoutDate) ?? '2+ yıl';
}

/** Ürün detay tablosu — sonsuz kaydırma sentinel'li, filtrelenmiş satırları çizer. */
export function AnalysisTable({
  rows,
  windowDays,
  metric,
  showTrend,
  hasMore,
  loadingMore,
  onLoadMore,
  hasActiveFilters,
  onClearFilters,
  onSelectProduct,
  pendingProductId,
  sortBy,
  sortReversed,
  onSortBy,
  onToggleSortDirection,
}: AnalysisTableProps) {
  // Kolon → filtre şeridindeki sıralama seçeneği (hepsi doğal olarak azalan);
  // değer kolonu metrikle birlikte ciro/kâr arasında değişir.
  const columnSort: Record<SortColumn, AnalysisSortBy> = {
    value: metric === 'kar' ? 'kar' : 'ciro',
    sold: 'satis',
    stockLife: 'stok-omru',
    capital: 'sermaye',
  };
  const activeColumn =
    (Object.keys(columnSort) as SortColumn[]).find(col => columnSort[col] === sortBy) ?? null;
  const direction: SortDirection = sortReversed ? 'asc' : 'desc';
  const sortProps = {
    activeKey: activeColumn,
    direction,
    onSort: (col: SortColumn) => (col === activeColumn ? onToggleSortDirection() : onSortBy(columnSort[col])),
  };

  if (rows.length === 0) {
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
          <DataTableHeadCell edge>Ürün</DataTableHeadCell>
          <DataTableHeadCell align="center">Sınıf</DataTableHeadCell>
          <DataTableSortHeadCell sortKey="value" align="right" {...sortProps}>
            {metric === 'kar' ? 'Kâr' : 'Ciro'} ({windowDays}g)
          </DataTableSortHeadCell>
          {showTrend && (
            <DataTableHeadCell align="right" title={`Ciro, önceki ${windowDays} güne göre`}>
              Trend
            </DataTableHeadCell>
          )}
          <DataTableSortHeadCell sortKey="sold" align="right" {...sortProps}>Satış</DataTableSortHeadCell>
          <DataTableHeadCell align="right">Stok</DataTableHeadCell>
          <DataTableHeadCell align="right" title="Satılan ÷ (satılan + kalan)">
            Sell-through
          </DataTableHeadCell>
          <DataTableSortHeadCell sortKey="stockLife" align="right" {...sortProps}>Stok Ömrü</DataTableSortHeadCell>
          <DataTableHeadCell align="right">Tükeniş</DataTableHeadCell>
          <DataTableSortHeadCell sortKey="capital" align="right" edge {...sortProps}>Bağlı Sermaye</DataTableSortHeadCell>
        </DataTableHeaderRow>
        <tbody>
          {rows.map(item => (
            <DataTableRow
              key={item.productId}
              onClick={() => onSelectProduct(item.productId)}
              pending={pendingProductId === item.productId}
            >
              <DataTableCell edge>
                <div className="flex items-center gap-2.5">
                  <ProductThumb src={item.imageUrl ?? undefined} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
                  <span className="truncate font-medium text-foreground">{item.productName}</span>
                </div>
              </DataTableCell>
              <DataTableCell align="center">
                <AbcBadge cls={metric === 'kar' ? item.profitAbcClass : item.abcClass} />
              </DataTableCell>
              <DataTableCell numeric>
                {formatPrice(metric === 'kar' ? item.profit : item.revenue)}
                {metric === 'kar' && item.profitIsEstimate && (
                  <span className="text-xs text-muted-foreground" title="Alış fiyatı eksik — kâr yaklaşık">~</span>
                )}
              </DataTableCell>
              {showTrend && (
                <DataTableCell align="right">
                  {item.revenueTrendPct === null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <TrendBadge value={item.revenueTrendPct} size="sm" />
                  )}
                </DataTableCell>
              )}
              <DataTableCell numeric>{item.soldQty}</DataTableCell>
              <DataTableCell numeric>{item.totalStock}</DataTableCell>
              <DataTableCell align="right">
                <SellThroughBadge rate={item.sellThrough} band={item.sellThroughBand} />
              </DataTableCell>
              <DataTableCell align="right">
                {item.totalStock === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <StockLifeBadge days={item.daysOfStock} />
                )}
              </DataTableCell>
              <DataTableCell numeric className="text-xs">
                <span
                  className={
                    item.stockoutBeforeLeadTime && item.totalStock > 0
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {stockoutLabel(item)}
                </span>
              </DataTableCell>
              <DataTableCell numeric edge className="font-medium">
                {formatPrice(item.stockValue)}
                {item.isEstimate && item.totalStock > 0 && (
                  <span className="text-xs text-muted-foreground" title="Alış fiyatı tanımlı değil">~</span>
                )}
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTable>

      <InfiniteScrollFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} itemCount={rows.length} />
    </>
  );
}
