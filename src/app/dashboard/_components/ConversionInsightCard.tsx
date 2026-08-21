'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import type { ConversionInsightApiResponse } from '@/app/api/insights/conversion/route';
import { Badge } from '@/components/ui/badge';
import {
  DataTable,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from '@/components/shared/data-table/data-table';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { TableFooterNote } from '@/components/shared/data-table/TableFooterNote';
import { ProductThumb } from '@/components/shared/filters/atoms';
import { DashboardListSection } from './DashboardListSection';

function formatPercent(rate: number): string {
  return `%${(rate * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

const TITLE = 'Görüntülenme → Satış Dönüşümü';
const MAX_ROWS = 8;

/**
 * Görüntülenme → satış dönüşümü kartı.
 *
 * Tracker'ın topladığı görüntülenme verisini satışla birleştirir;
 * "çok görüntülenen ama az satan" ürünleri öne çıkarır (fiyat/görsel/açıklama
 * sorununun en güçlü sinyali).
 */
export function ConversionInsightCard({ insight }: { insight: ConversionInsightApiResponse | null }) {
  const router = useRouter();

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
    <DashboardListSection
      title={TITLE}
      subtitle={subtitle}
      badge={
        flagged > 0 ? (
          <Badge variant="warning" size="md">{flagged} ürün ilgi görüyor ama satmıyor</Badge>
        ) : undefined
      }
    >
      <DataTable>
        <DataTableHeaderRow>
          <DataTableHeadCell edge>Ürün</DataTableHeadCell>
          <DataTableHeadCell align="right">Görüntülenme</DataTableHeadCell>
          <DataTableHeadCell align="right">Satış</DataTableHeadCell>
          <DataTableHeadCell align="right" edge>Dönüşüm</DataTableHeadCell>
        </DataTableHeaderRow>
        <tbody>
          {shown.map(item => (
            <DataTableRow
              key={item.productId}
              onClick={() => router.push(`/dashboard/stok?product=${item.productId}`)}
            >
              <DataTableCell edge>
                <div className="flex items-center gap-2.5">
                  <ProductThumb src={item.imageUrl ?? undefined} alt="" sizeClass="h-7 w-7" roundedClass="rounded" />
                  <span className="truncate font-medium text-foreground">{item.productName}</span>
                  {item.lowConversion && (
                    <Badge variant="warning" className="shrink-0">
                      düşük dönüşüm
                    </Badge>
                  )}
                </div>
              </DataTableCell>
              <DataTableCell numeric>{item.views.toLocaleString('tr-TR')}</DataTableCell>
              <DataTableCell numeric>{item.soldQty.toLocaleString('tr-TR')}</DataTableCell>
              <DataTableCell numeric edge className="font-medium">
                {formatPercent(item.conversionRate)}
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTable>
      <TableFooterNote>
        {insight.items.length > shown.length
          ? `İlk ${shown.length} ürün gösteriliyor · ${insight.items.length} üründe görüntülenme verisi var`
          : `${shown.length} ürün listelendi`}
        {flagged > 0 && <> · &quot;düşük dönüşüm&quot; = dönüşüm, mağaza ortalamasının yarısının altında</>}
      </TableFooterNote>
    </DashboardListSection>
  );
}
