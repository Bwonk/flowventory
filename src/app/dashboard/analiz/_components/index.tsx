'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { ProductDetailModal } from '@/app/dashboard/stok/_components/product-detail/ProductDetailModal';
import { ApiRequests } from '@/lib/api-requests';
import type { Product } from '@/lib/products/types';
import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { TableSection } from '@/components/shared/data-table/TableSection';
import { SegmentedControl } from '@/components/shared/trend-chart/SegmentedControl';
import { AbcSection, type NormalizedAbcRow } from './AbcSection';
import { ActionPanel } from './ActionPanel';
import { AgingSection } from './AgingSection';
import { AnalysisFilterBar } from './AnalysisFilterBar';
import { AnalysisTable } from './AnalysisTable';
import { VelocitySection } from './VelocitySection';
import { WINDOW_OPTIONS, type AnalysisMetric, type WindowOption } from './constants';
import { useAnalysisFilters, type AnalysisInitialFilters } from './hooks/use-analysis-filters';

interface AnalizContentProps {
  insight: InventoryInsightApiResponse;
  token: string | null;
  initialFilters?: AnalysisInitialFilters;
  onWindowChange: (windowDays: 30 | 60) => void;
}

/** Modal'ın ihtiyaç duyduğu, ilk satır tıklamasında tembel çekilen veri seti. */
interface DetailData {
  products: Product[];
  analytics: AnalyticsApiResponse | null;
  viewStats: Record<string, number> | null;
}

/**
 * Analiz sayfası — ABC (ciro/kâr Pareto'su) + stok yaşlandırma + aksiyon paneli.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export function AnalizContent({ insight, token, initialFilters, onWindowChange }: AnalizContentProps) {
  const router = useRouter();
  const hasEstimate = insight.items.some(i => i.isEstimate && i.totalStock > 0);
  const hasProfitEstimate = insight.items.some(i => i.profitIsEstimate);

  // Ciro|Kâr toggle'ı: her iki sınıflandırma da API yanıtında hazır, refetch yok.
  const [metric, setMetric] = useState<AnalysisMetric>('ciro');

  const filters = useAnalysisFilters(insight.items, insight.targetStockDays, metric, initialFilters);

  const abcRows: NormalizedAbcRow[] =
    metric === 'kar'
      ? insight.abcSummaryProfit.map(r => ({
          class: r.class,
          productCount: r.productCount,
          share: r.profitShare,
          stockValue: r.stockValue,
        }))
      : insight.abcSummary.map(r => ({
          class: r.class,
          productCount: r.productCount,
          share: r.revenueShare,
          stockValue: r.stockValue,
        }));

  const tableRef = useRef<HTMLElement | null>(null);
  const scrollToTable = useCallback(() => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Özet kartları toggle mantığıyla filtreler: aktif seçime tekrar tıklamak temizler,
  // yeni seçim tabloya kaydırır.
  const handleAbcSelect = (cls: AbcClass) => {
    const clearing = filters.abc === cls;
    filters.setAbc(clearing ? 'all' : cls);
    if (!clearing) scrollToTable();
  };
  const handleAgingSelect = (bucket: AgingBucketKey) => {
    const clearing = filters.aging === bucket;
    filters.setAging(clearing ? 'all' : bucket);
    if (!clearing) scrollToTable();
  };
  const handleBandSelect = (band: SellThroughBand) => {
    const clearing = filters.band === band;
    filters.setBand(clearing ? 'all' : band);
    if (!clearing) scrollToTable();
  };
  const handleActionSelect = (action: ActionKey) => {
    const clearing = filters.action === action;
    filters.setAction(clearing ? 'all' : action);
    if (!clearing) scrollToTable();
  };

  // Ürün detay modalı — verisi ilk satır tıklamasında çekilir, oturum boyunca cache'lenir.
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const ensureDetailData = useCallback(async (): Promise<DetailData | null> => {
    if (detailData) return detailData;
    if (!token) return null;
    try {
      const [productsRes, analyticsRes, viewStatsRes] = await Promise.all([
        ApiRequests.ikas.listProducts(token),
        ApiRequests.ikas.getAnalytics(token),
        ApiRequests.productView.getViewStats(token),
      ]);
      const products =
        productsRes.status === 200 && productsRes.data?.data?.products ? productsRes.data.data.products : [];
      if (products.length === 0) return null;
      const data: DetailData = {
        products,
        analytics: analyticsRes.status === 200 && analyticsRes.data?.data ? analyticsRes.data.data : null,
        viewStats:
          viewStatsRes.status === 200 && viewStatsRes.data?.data
            ? (viewStatsRes.data.data as Record<string, number>)
            : null,
      };
      setDetailData(data);
      return data;
    } catch (error) {
      logger.error('Error fetching product detail data', { error });
      return null;
    }
  }, [detailData, token]);

  const handleSelectProduct = useCallback(
    async (productId: string) => {
      if (pendingProductId) return;
      setPendingProductId(productId);
      const data = await ensureDetailData();
      setPendingProductId(null);
      const product = data?.products.find(p => p.id === productId) ?? null;
      if (!product) {
        // Veri çekilemedi ya da ürün listede yok (aradaki sync'te silinmiş olabilir):
        // stok sayfası ?product paramını zaten destekliyor, oraya düş.
        router.push(`/dashboard/stok?product=${productId}`);
        return;
      }
      setSelectedProduct(product);
    },
    [pendingProductId, ensureDetailData, router],
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="ANALİZ"
        title="Envanter Analizi"
        description={`Son ${insight.windowDays} günün satışına göre ABC sınıflandırması, satış hızı ve stok yaşlandırma${hasEstimate ? ' · ~ işaretli değerler alış fiyatı yerine satış fiyatıyla hesaplandı' : ''}`}
        actions={
          <SegmentedControl<WindowOption>
            options={WINDOW_OPTIONS}
            value={String(insight.windowDays) as WindowOption}
            onChange={value => onWindowChange(value === '60' ? 60 : 30)}
            aria-label="Analiz penceresi"
          />
        }
      />

      <ActionPanel
        items={insight.items}
        actionByProduct={filters.actionByProduct}
        targetStockDays={insight.targetStockDays}
        windowDays={insight.windowDays}
        selected={filters.action}
        onSelect={handleActionSelect}
      />

      <AbcSection
        rows={abcRows}
        metric={metric}
        onMetricChange={setMetric}
        hasProfitEstimate={hasProfitEstimate}
        selected={filters.abc}
        onSelect={handleAbcSelect}
      />

      <VelocitySection
        sellThrough={insight.sellThroughSummary}
        trend={insight.trend}
        windowDays={insight.windowDays}
        leadTimeDays={insight.leadTimeDays}
        selectedBand={filters.band}
        onSelectBand={handleBandSelect}
      />

      <AgingSection buckets={insight.agingBuckets} selected={filters.aging} onSelect={handleAgingSelect} />

      <TableSection label="Ürün detayı" sectionRef={tableRef}>
        <AnalysisFilterBar filters={filters} />
        <AnalysisTable
          rows={filters.displayedRows}
          windowDays={insight.windowDays}
          metric={metric}
          showTrend={insight.trend !== null}
          hasMore={filters.hasMore}
          loadingMore={filters.loadingMore}
          onLoadMore={filters.loadMore}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={filters.clearAllFilters}
          onSelectProduct={handleSelectProduct}
          pendingProductId={pendingProductId}
          sortBy={filters.sortBy}
          sortReversed={filters.sortReversed}
          onSortBy={filters.setSortBy}
          onToggleSortDirection={filters.toggleSortDirection}
        />
      </TableSection>

      <ProductDetailModal
        product={selectedProduct}
        analytics={detailData?.analytics ?? null}
        token={token}
        viewStats={detailData?.viewStats}
        onClose={() => setSelectedProduct(null)}
      />
    </PageContainer>
  );
}
