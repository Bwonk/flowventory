'use client';

import React from 'react';
import type { StockHistoryApiResponse } from '@/app/api/stock-history/route';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { TrendBadge } from '@/components/shared/badges/TrendBadge';
import { formatPrice } from '@/lib/currency';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Ürün modal'ının 30 günlük stat şeridi — kartlar sayıyı, Stok Yolu grafiği
 * zamanı gösterir (aynı veri). Dashboard `KpiTile` p-5/2xl ile 780px modala
 * sığmadığı için kompakt yerel karo kullanılır (DESIGN.md "Yoğun stat tile").
 */

const MetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ label, value, footer, className }) => (
  <div className={cn('flex min-w-0 flex-col p-3', className)}>
    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 truncate font-mono text-base font-medium tabular-nums text-foreground">{value}</p>
    <div className="mt-1 flex min-h-4 items-center gap-1.5 truncate text-[11px] text-muted-foreground">{footer}</div>
  </div>
);

const Pending = () => <span className="text-muted-foreground">…</span>;

const formatVelocity = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export const ProductMetricStrip: React.FC<{
  revenue: number;
  soldCount: number;
  /** Ürünün/varyantın mağaza cirosundaki payı (0–1). */
  share: number;
  views: number | null;
  viewsLoading: boolean;
  /** Varyant seçiliyken görüntülenme ürün geneli kalır (varyant kırılımı yok). */
  isVariant: boolean;
  stock: StockHistoryApiResponse | null;
  stockLoading: boolean;
}> = ({ revenue, soldCount, share, views, viewsLoading, isVariant, stock, stockLoading }) => {
  const velocity = stock?.velocityPerDay ?? (soldCount > 0 ? soldCount / 30 : 0);
  const cover = stock?.daysOfCover ?? null;

  const changeValue = stockLoading ? (
    <Pending />
  ) : stock?.delta === null || stock?.delta === undefined ? (
    '—'
  ) : (
    `${stock.delta > 0 ? '+' : ''}${formatNumber(stock.delta)} adet`
  );

  const changeFooter = stockLoading ? null : !stock ? (
    'veri alınamadı'
  ) : stock.previous === null ? (
    stock.trackedSinceDays === null
      ? 'Veri toplanıyor'
      : `Veri toplanıyor · ${stock.trackedSinceDays} gündür kayıt`
  ) : (
    <>
      {stock.deltaPct !== null && <TrendBadge value={Math.round(stock.deltaPct)} />}
      <span className="tabular-nums">
        {formatNumber(stock.previous)} → {formatNumber(stock.current)}
      </span>
    </>
  );

  return (
    <section
      aria-label="Son 30 gün özeti"
      className="grid shrink-0 grid-cols-2 divide-x divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-card sm:grid-cols-5 sm:divide-y-0"
    >
      <MetricTile
        label="30G Ciro"
        value={formatPrice(revenue)}
        footer={share > 0 ? `${formatPercent(share)} ciro payı` : 'satış yok'}
      />
      <MetricTile
        label="30G Satış"
        value={`${formatNumber(soldCount)} adet`}
        footer={soldCount > 0 ? `~${formatVelocity(velocity)}/gün` : 'satış yok'}
      />
      <MetricTile
        label="Stok Ömrü"
        value={stockLoading ? <Pending /> : cover === null ? '—' : `~${formatNumber(cover)} gün`}
        footer={
          stockLoading ? null : stock ? (
            <>
              <StockLifeBadge days={cover} />
              <span className="tabular-nums">
                {formatNumber(stock.current)} adet · {formatVelocity(velocity)}/gün
              </span>
            </>
          ) : (
            'veri alınamadı'
          )
        }
      />
      <MetricTile label="Stok Değişimi 30G" value={changeValue} footer={changeFooter} />
      <MetricTile
        label="Görüntülenme"
        value={viewsLoading ? <Pending /> : views === null ? '—' : formatNumber(views)}
        footer={isVariant ? 'ürün geneli' : 'son 30 gün'}
        className="max-sm:col-span-2"
      />
    </section>
  );
};
