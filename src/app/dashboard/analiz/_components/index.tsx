'use client';

import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { AbcSection } from './AbcSection';
import { AgingSection } from './AgingSection';
import { AnalysisTable } from './AnalysisTable';
import { VelocitySection } from './VelocitySection';

interface AnalizContentProps {
  insight: InventoryInsightApiResponse;
}

/**
 * Analiz sayfası — ABC (ciro Pareto'su) + stok yaşlandırma.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export function AnalizContent({ insight }: AnalizContentProps) {
  const hasEstimate = insight.items.some(i => i.isEstimate && i.totalStock > 0);

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

      <AnalysisTable items={insight.items} windowDays={insight.windowDays} />
    </PageContainer>
  );
}
