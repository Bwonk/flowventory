'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye } from 'lucide-react';
import type { ConversionInsightApiResponse } from '@/app/api/insights/conversion/route';
import { Badge } from '@/components/ui/badge';
import { Table, type TableColumn } from '@/components/motion/table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { TableFooterNote } from '@/components/shared/data-table/TableFooterNote';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { DashboardListSection } from './DashboardListSection';

type ConversionItem = ConversionInsightApiResponse['items'][number];

function formatPercent(rate: number): string {
  return `%${(rate * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

const TITLE = 'Görüntülenme → Satış Dönüşümü';
const MAX_ROWS = 8;

const COLUMNS: TableColumn<ConversionItem>[] = [
  {
    key: 'product',
    header: 'Ürün',
    minWidth: 200,
    cell: item => (
      <div className="flex items-center gap-2.5">
        <ProductThumb src={item.imageUrl ?? undefined} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
        <span className="truncate font-medium text-foreground">{item.productName}</span>
        {item.lowConversion && (
          <Badge variant="warning" className="shrink-0">
            Düşük Dönüşüm
          </Badge>
        )}
      </div>
    ),
  },
  { key: 'views', header: 'Görüntülenme', numeric: true, width: '128px', cell: item => item.views.toLocaleString('tr-TR') },
  { key: 'sold', header: 'Satış', numeric: true, width: '96px', cell: item => item.soldQty.toLocaleString('tr-TR') },
  {
    key: 'conversion',
    header: 'Dönüşüm',
    numeric: true,
    width: '112px',
    cellClassName: 'font-medium',
    cell: item => formatPercent(item.conversionRate),
  },
];

/**
 * Görüntülenme → satış dönüşümü kartı.
 *
 * Tracker'ın topladığı görüntülenme verisini satışla birleştirir;
 * "çok görüntülenen ama az satan" ürünleri öne çıkarır (fiyat/görsel/açıklama
 * sorununun en güçlü sinyali).
 */
export function ConversionInsightCard({
  insight,
  error,
  onRetry,
}: {
  insight: ConversionInsightApiResponse | null;
  /** Fetch düştü — onboarding kopyası yerine yeniden dene durumu gösterilir. */
  error?: boolean;
  onRetry?: () => void;
}) {
  const router = useRouter();

  if (error) {
    return (
      <DashboardListSection title={TITLE}>
        <EmptyState
          icon={AlertTriangle}
          message="Dönüşüm verisi alınamadı."
          actionLabel={onRetry ? 'Tekrar dene' : undefined}
          onAction={onRetry}
        />
      </DashboardListSection>
    );
  }

  if (!insight || insight.totalViews === 0) {
    return (
      <DashboardListSection title={TITLE}>
        <EmptyState
          icon={Eye}
          message="Henüz görüntülenme verisi yok"
          description={
            <>
              Ürün görüntülenmelerini toplamak için{' '}
              <Link href="/dashboard/ayarlar" className="underline hover:text-foreground">
                Ayarlar&apos;dan takip scriptini kurun
              </Link>
              .
            </>
          }
        />
      </DashboardListSection>
    );
  }

  const subtitle = `Son ${insight.windowDays} gün · mağaza ortalaması ${formatPercent(insight.overallConversionRate)}`;
  const shown = insight.items.slice(0, MAX_ROWS);
  const flagged = insight.items.filter(i => i.lowConversion).length;

  if (shown.length === 0) {
    return (
      <DashboardListSection title={TITLE} subtitle={subtitle}>
        <EmptyState icon={Eye} message="Öne çıkan dönüşüm sinyali yok" />
      </DashboardListSection>
    );
  }

  return (
    <DashboardListSection title={TITLE} subtitle={subtitle}>
      <Table
        data={shown}
        columns={COLUMNS}
        getRowId={item => item.productId}
        onRowClick={item => router.push(`/dashboard/stok?product=${item.productId}`)}
      />
      <TableFooterNote>
        {insight.items.length > shown.length
          ? `İlk ${shown.length} ürün gösteriliyor · ${insight.items.length} üründe görüntülenme verisi var`
          : `${shown.length} ürün listelendi`}
        {flagged > 0 && <> · &quot;Düşük Dönüşüm&quot; = dönüşüm, mağaza ortalamasının yarısının altında</>}
      </TableFooterNote>
    </DashboardListSection>
  );
}
