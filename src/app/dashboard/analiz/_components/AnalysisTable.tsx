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
} from '@/components/shared/data-table/data-table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { InfiniteScrollFooter } from '@/components/shared/data-table/InfiniteScrollFooter';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { formatPrice } from '@/lib/currency';
import { formatDateKey } from '@/lib/format';
import { AbcBadge } from '@/components/shared/badges/AbcBadge';
import { type AnalysisMetric } from './constants';

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
}

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
}: AnalysisTableProps) {
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
          <DataTableHeadCell align="right">
            {metric === 'kar' ? 'Kâr' : 'Ciro'} ({windowDays}g)
          </DataTableHeadCell>
          {showTrend && (
            <DataTableHeadCell align="right" title={`Ciro, önceki ${windowDays} güne göre`}>
              Trend
            </DataTableHeadCell>
          )}
          <DataTableHeadCell align="right">Satış</DataTableHeadCell>
          <DataTableHeadCell align="right">Stok</DataTableHeadCell>
          <DataTableHeadCell align="right" title="Satılan ÷ (satılan + kalan)">
            Sell-through
          </DataTableHeadCell>
          <DataTableHeadCell align="right">Stok Ömrü</DataTableHeadCell>
          <DataTableHeadCell align="right">Tükeniş</DataTableHeadCell>
          <DataTableHeadCell align="right" edge>Bağlı Sermaye</DataTableHeadCell>
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
