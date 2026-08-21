'use client';

import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatNumber } from '@/lib/format';
import { AbcSection } from './AbcSection';
import { AgingSection } from './AgingSection';
import { AnalysisFilterBar } from './AnalysisFilterBar';
import { AnalysisTable } from './AnalysisTable';
import { VelocitySection } from './VelocitySection';
import { useAnalysisFilters } from './hooks/use-analysis-filters';

interface AnalizContentProps {
  insight: InventoryInsightApiResponse;
}

/**
 * Analiz sayfası — ABC (ciro Pareto'su) + stok yaşlandırma.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export function AnalizContent({ insight }: AnalizContentProps) {
  const hasEstimate = insight.items.some(i => i.isEstimate && i.totalStock > 0);

  const filters = useAnalysisFilters(insight.items, insight.targetStockDays, 'ciro');

  return (
    <PageContainer>
      <PageHeader
        eyebrow="ANALİZ"
        title="Envanter Analizi"
        description={`Son ${insight.windowDays} günün satışına göre ABC sınıflandırması, satış hızı ve stok yaşlandırma${hasEstimate ? ' · ~ işaretli değerler alış fiyatı yerine satış fiyatıyla hesaplandı' : ''}`}
      />

      <AbcSection summary={insight.abcSummary} />

      <VelocitySection
        sellThrough={insight.sellThroughSummary}
        windowDays={insight.windowDays}
        leadTimeDays={insight.leadTimeDays}
      />

      <AgingSection buckets={insight.agingBuckets} />

      <section className="overflow-hidden rounded-lg border border-hairline bg-card">
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
