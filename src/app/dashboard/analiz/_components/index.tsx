'use client';

import { useCallback, useRef, useState } from 'react';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SegmentedControl } from '@/components/shared/trend-chart/SegmentedControl';
import { formatNumber } from '@/lib/format';
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
  initialFilters?: AnalysisInitialFilters;
  onWindowChange: (windowDays: 30 | 60) => void;
}

/**
 * Analiz sayfası — ABC (ciro/kâr Pareto'su) + stok yaşlandırma + aksiyon paneli.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export function AnalizContent({ insight, initialFilters, onWindowChange }: AnalizContentProps) {
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

      <section ref={tableRef} className="scroll-mt-4 overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">Ürün Detayı</h2>
          <p className="text-xs text-muted-foreground">{formatNumber(filters.totalResults)} ürün listeleniyor</p>
        </div>
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
        />
      </section>
    </PageContainer>
  );
}
