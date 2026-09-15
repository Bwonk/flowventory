'use client';

import { useCallback, useMemo } from 'react';
import type { InventoryInsightItem } from '@/app/api/insights/inventory/route';
import { SellThroughBadge } from '@/components/shared/badges/SellThroughBadge';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { TrendBadge } from '@/components/shared/badges/TrendBadge';
import { Table, type SortDirection, type SortState, type TableColumn } from '@/components/motion/table';
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
 * Stok ömrü rozetinin tooltip'i: tahmini tükeniş tarihi (stok ömrü + bugün).
 * Tarih yoksa (satış yok / 2 yıldan uzun) rozet kendi kademe metnini gösterir.
 */
function stockoutTitle(item: InventoryInsightItem): string | undefined {
  const date = formatDateKey(item.stockoutDate);
  if (!date) return undefined;
  return item.stockoutBeforeLeadTime ? `Tahmini tükeniş: ${date} · tedarik süresinden önce` : `Tahmini tükeniş: ${date}`;
}

/** Ürün detay tablosu — sonsuz kaydırma sentinel'li, filtrelenmiş satırları çizer; 80+ satırda sanal liste. */
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
  const columnSort: Record<SortColumn, AnalysisSortBy> = useMemo(
    () => ({
      value: metric === 'kar' ? 'kar' : 'ciro',
      sold: 'satis',
      stockLife: 'stok-omru',
      capital: 'sermaye',
    }),
    [metric],
  );
  const activeColumn = (Object.keys(columnSort) as SortColumn[]).find(col => columnSort[col] === sortBy) ?? null;
  const direction: SortDirection = sortReversed ? 'asc' : 'desc';
  const sort = useMemo<SortState | null>(() => (activeColumn ? { key: activeColumn, direction } : null), [activeColumn, direction]);

  const handleSortChange = useCallback(
    (next: SortState | null) => {
      if (!next) return;
      const col = next.key as SortColumn;
      if (col === activeColumn) onToggleSortDirection();
      else onSortBy(columnSort[col]);
    },
    [activeColumn, columnSort, onSortBy, onToggleSortDirection],
  );

  const columns = useMemo<TableColumn<InventoryInsightItem>[]>(
    () => [
      {
        key: 'product',
        header: 'Ürün',
        minWidth: 220,
        cell: item => (
          <div className="flex items-center gap-2.5">
            <ProductThumb src={item.imageUrl ?? undefined} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
            <span className="truncate font-medium text-foreground">{item.productName}</span>
          </div>
        ),
      },
      {
        key: 'abc',
        header: 'Sınıf',
        align: 'center',
        width: '72px',
        cell: item => <AbcBadge cls={metric === 'kar' ? item.profitAbcClass : item.abcClass} />,
      },
      {
        key: 'value',
        header: `${metric === 'kar' ? 'Kâr' : 'Ciro'} (${windowDays}g)`,
        sortable: true,
        defaultDirection: 'desc',
        numeric: true,
        width: '128px',
        cell: item => (
          <>
            {metric === 'kar' && item.profitIsEstimate && (
              <span className="text-xs text-muted-foreground" title="Alış fiyatı eksik — kâr yaklaşık">
                ~
              </span>
            )}
            {formatPrice(metric === 'kar' ? item.profit : item.revenue)}
          </>
        ),
      },
      ...(showTrend
        ? [
            {
              key: 'trend',
              header: 'Trend',
              headerTitle: `Ciro, önceki ${windowDays} güne göre`,
              align: 'right',
              width: '96px',
              cell: (item: InventoryInsightItem) =>
                item.revenueTrendPct === null ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <TrendBadge value={item.revenueTrendPct} size="sm" />
                ),
            } satisfies TableColumn<InventoryInsightItem>,
          ]
        : []),
      { key: 'sold', header: 'Satış', sortable: true, defaultDirection: 'desc', numeric: true, width: '88px', cell: item => item.soldQty },
      { key: 'stock', header: 'Stok', numeric: true, width: '80px', cell: item => item.totalStock },
      {
        key: 'sellThrough',
        header: 'Sell-through',
        headerTitle: 'Satılan ÷ (satılan + kalan)',
        align: 'right',
        width: '120px',
        cell: item => <SellThroughBadge rate={item.sellThrough} band={item.sellThroughBand} />,
      },
      {
        key: 'stockLife',
        header: 'Stok Ömrü',
        sortable: true,
        defaultDirection: 'desc',
        align: 'right',
        width: '112px',
        cell: item =>
          item.totalStock === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <StockLifeBadge days={item.daysOfStock} title={stockoutTitle(item)} />
          ),
      },
      {
        key: 'capital',
        header: 'Bağlı Sermaye',
        sortable: true,
        defaultDirection: 'desc',
        numeric: true,
        width: '136px',
        cellClassName: 'font-medium',
        cell: item => (
          <>
            {item.isEstimate && item.totalStock > 0 && (
              <span className="text-xs text-muted-foreground" title="Alış fiyatı tanımlı değil">
                ~
              </span>
            )}
            {formatPrice(item.stockValue)}
          </>
        ),
      },
    ],
    [metric, windowDays, showTrend],
  );

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
      <Table
        data={rows}
        columns={columns}
        getRowId={item => item.productId}
        rowHeight={49}
        onRowClick={item => onSelectProduct(item.productId)}
        rowState={item => ({ pending: pendingProductId === item.productId })}
        sort={sort}
        onSortChange={handleSortChange}
        clientSort={false}
      />

      <InfiniteScrollFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} itemCount={rows.length} />
    </>
  );
}
