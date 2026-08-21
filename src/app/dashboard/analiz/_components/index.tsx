'use client';

import { useCallback, useRef } from 'react';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/format';
import { AbcSection } from './AbcSection';
import { ActionPanel } from './ActionPanel';
import { AgingSection } from './AgingSection';
import { AnalysisFilterBar } from './AnalysisFilterBar';
import { AnalysisTable } from './AnalysisTable';
import { VelocitySection } from './VelocitySection';
import { useAnalysisFilters, type AnalysisInitialFilters } from './hooks/use-analysis-filters';

interface AnalizContentProps {
  insight: InventoryInsightApiResponse;
  initialFilters?: AnalysisInitialFilters;
}

/**
 * Analiz sayfası — ABC (ciro Pareto'su) + stok yaşlandırma.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export function AnalizContent({ insight, initialFilters }: AnalizContentProps) {
  const hasEstimate = insight.items.some(i => i.isEstimate && i.totalStock > 0);

  const filters = useAnalysisFilters(insight.items, insight.targetStockDays, 'ciro', initialFilters);

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
      />

      <ActionPanel
        items={insight.items}
        actionByProduct={filters.actionByProduct}
        targetStockDays={insight.targetStockDays}
        windowDays={insight.windowDays}
        selected={filters.action}
        onSelect={handleActionSelect}
      />

      <AbcSection summary={insight.abcSummary} selected={filters.abc} onSelect={handleAbcSelect} />

      <VelocitySection
        sellThrough={insight.sellThroughSummary}
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
