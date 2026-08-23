'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Package, Truck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPriceRounded } from '@/lib/currency';
import { KpiTile } from '@/app/dashboard/_components/KpiTile';
import type { PurchaseReportApiResponse } from '@/app/api/reports/purchase/route';
import { ConcaveFillet } from './ConcaveFillet';

interface ReportKpiStripProps {
  report: PurchaseReportApiResponse;
  /** Tab'daki tedarikçi sayısı (henüz ürünsüz yeni kayıtlar dahil). */
  vendorCount: number;
  /** Doluyken tek tedarikçi yazdırılıyor demektir; şerit çıktıya girmez. */
  printVendorId: string | null;
  /** Sayfa aksiyonları — panelin sağ üstünden yükselen birleşik rafta yaşar. */
  actions?: ReactNode;
}

/**
 * Satın alma raporu metrik paneli — dashboard KPI motifi + sayfa aksiyonlarını
 * taşıyan "çentikli panel" silüeti: raf ve kart tek yüzeydir. Raf `-mb-px` ile
 * kartın üst kenarlığını örter (dikiş çizgisi kalmaz), kartın sağ üst köşesini
 * devralır; sol kenarı karta içbükey SVG kavisle bağlanır.
 */
export function ReportKpiStrip({ report, vendorCount, printVendorId, actions }: ReportKpiStripProps) {
  const hasEstimate = report.vendors.some(v => v.hasEstimate);
  const unassignedLines = report.vendors.find(v => v.vendorId === null)?.lines.length ?? 0;

  return (
    <section
      aria-label="Rapor özeti"
      className={cn('mb-4', printVendorId !== null && 'print:hidden')}
    >
      {actions && (
        <div className="flex justify-end print:hidden">
          <div className="relative z-10 -mb-px flex max-w-full flex-wrap items-center justify-end gap-1 rounded-tr-lg border-t border-r border-hairline bg-card px-2 py-1.5">
            {/* Rafın sol kenarlığı yoktur — sol siluetin tamamı kavistir;
                eğri tedarikçi tab'larıyla birebir aynı (Akışkan S). */}
            <ConcaveFillet side="left" />
            {actions}
          </div>
        </div>
      )}
      <div className="@container overflow-hidden rounded-lg rounded-tr-none border border-hairline bg-card print:rounded-lg">
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
      </div>
    </section>
  );
}
