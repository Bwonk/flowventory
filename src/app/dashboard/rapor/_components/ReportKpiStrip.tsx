'use client';

import { AlertTriangle, Package, Truck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPriceRounded } from '@/lib/currency';
import { KpiTile } from '@/app/dashboard/_components/KpiTile';
import type { PurchaseReportApiResponse } from '@/app/api/reports/purchase/route';

interface ReportKpiStripProps {
  report: PurchaseReportApiResponse;
  /** Tab'daki tedarikçi sayısı (henüz ürünsüz yeni kayıtlar dahil). */
  vendorCount: number;
  /** Doluyken tek tedarikçi yazdırılıyor demektir; şerit çıktıya girmez. */
  printVendorId: string | null;
}

/** Satın alma raporu metrik paneli — dashboard KPI motifi, düz hairline kart. */
export function ReportKpiStrip({ report, vendorCount, printVendorId }: ReportKpiStripProps) {
  const hasEstimate = report.vendors.some(v => v.hasEstimate);
  const unassignedLines = report.vendors.find(v => v.vendorId === null)?.lines.length ?? 0;

  return (
    <section
      aria-label="Rapor özeti"
      className={cn(
        '@container mb-4 overflow-hidden rounded-lg border border-hairline bg-card',
        printVendorId !== null && 'print:hidden',
      )}
    >
      <div className="-mr-px -mb-px grid grid-cols-1 @2xl:grid-cols-4">
        <KpiTile
          icon={Wallet}
          label="Toplam Maliyet"
          value={formatPriceRounded(report.totalCost)}
          valueSuffix={
            hasEstimate ? (
              <p
                className="truncate text-xs text-muted-foreground"
                title="Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı"
              >
                tahmini
              </p>
            ) : undefined
          }
          stagger={0}
        />
        <KpiTile icon={Package} label="Sipariş Satırı" value={report.lineCount} stagger={1} />
        <KpiTile
          icon={AlertTriangle}
          label="Acil"
          value={
            <span className={report.urgentCount > 0 ? 'text-status-critical' : undefined}>
              {report.urgentCount}
            </span>
          }
          stagger={2}
        />
        <KpiTile
          icon={Truck}
          label="Tedarikçi"
          value={vendorCount}
          footer={
            unassignedLines > 0 ? (
              <p className="truncate text-xs text-muted-foreground">{unassignedLines} ürün atanmamış</p>
            ) : undefined
          }
          stagger={3}
        />
      </div>
    </section>
  );
}
