'use client';

import Link from 'next/link';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { SellThroughBand } from '@/lib/reports/sell-through';
import { TrendBadge } from '@/components/shared/badges/TrendBadge';
import { formatDateKey, formatNumber, formatPercent } from '@/lib/format';
import { SELL_THROUGH_BAND_DOT, SELL_THROUGH_BAND_LABEL, SELL_THROUGH_BAND_ORDER, type BandFilter } from './constants';

interface VelocitySectionProps {
  sellThrough: InventoryInsightApiResponse['sellThroughSummary'];
  /** Önceki eşit döneme göre değişim — window=60'ta null, hiç gösterilmez. */
  trend: InventoryInsightApiResponse['trend'];
  windowDays: number;
  leadTimeDays: number;
  selectedBand: BandFilter;
  onSelectBand: (band: SellThroughBand) => void;
}

/** Satış hızı — mağaza geneli sell-through, yıllık devir, bant dağılımı, tükeniş riski. */
export function VelocitySection({ sellThrough, trend, windowDays, leadTimeDays, selectedBand, onSelectBand }: VelocitySectionProps) {
  const hasTrendBadges = trend !== null && (trend.revenueDeltaPct !== null || trend.soldUnitsDeltaPct !== null);

  return (
    <section className="mb-4 rounded-lg border border-hairline bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Satış Hızı</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Son {windowDays} günde satılan mal, eldeki mala oranla ne kadar eridi
          </p>
        </div>
        {hasTrendBadges && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {trend.revenueDeltaPct !== null && (
              <span className="flex items-center gap-1.5">
                Ciro <TrendBadge value={trend.revenueDeltaPct} size="sm" />
              </span>
            )}
            {trend.soldUnitsDeltaPct !== null && (
              <span className="flex items-center gap-1.5">
                Adet <TrendBadge value={trend.soldUnitsDeltaPct} size="sm" />
              </span>
            )}
            <span className="text-[11px]">önceki {windowDays} güne göre</span>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">SELL-THROUGH</p>
          <p className="mt-1 font-mono text-xl font-medium tabular-nums xl:text-2xl text-foreground">
            {sellThrough.overall === null ? '—' : formatPercent(sellThrough.overall, 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(sellThrough.soldUnits)} adet satıldı · {formatNumber(sellThrough.stockUnits)} adet elde
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-status-healthy"
              style={{ width: `${Math.round((sellThrough.overall ?? 0) * 100)}%` }}
            />
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">YILLIK DEVİR</p>
          <p className="mt-1 font-mono text-xl font-medium tabular-nums xl:text-2xl text-foreground">
            {sellThrough.turnoverRate === null
              ? '—'
              : `~${sellThrough.turnoverRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}×`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu hızla devam ederse stok yılda bu kadar kez döner
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            ~ : dönem ortalaması yerine bugünkü stoğa göre yaklaşık
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">ÜRÜN DAĞILIMI</p>
          <ul className="mt-2 space-y-0.5">
            {SELL_THROUGH_BAND_ORDER.map(band => {
              const isSelected = selectedBand === band;
              return (
                <li key={band}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectBand(band)}
                    className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                      isSelected ? 'bg-muted' : 'hover:bg-muted/40'
                    }`}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${SELL_THROUGH_BAND_DOT[band]}`} />
                    <span className="flex-1 text-muted-foreground">{SELL_THROUGH_BAND_LABEL[band]}</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {sellThrough.bandCounts[band]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {sellThrough.stockoutRiskCount > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium text-foreground">
            {sellThrough.stockoutRiskCount} ürün tedarik süresinden ({leadTimeDays} gün) önce tükeniyor
          </p>
          <ul className="mt-2 space-y-1">
            {sellThrough.stockoutRisk.map(risk => (
              <li key={risk.productId} className="flex items-baseline justify-between gap-4 text-xs">
                <span className="truncate text-muted-foreground">{risk.productName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {risk.totalStock} adet · {formatDateKey(risk.stockoutDate) ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          {sellThrough.stockoutRiskCount > sellThrough.stockoutRisk.length && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              +{sellThrough.stockoutRiskCount - sellThrough.stockoutRisk.length} ürün daha
            </p>
          )}
          <Link href="/dashboard/rapor" className="mt-3 inline-block text-xs font-medium text-foreground underline underline-offset-2">
            Satın alma raporunu aç →
          </Link>
        </div>
      )}
    </section>
  );
}
