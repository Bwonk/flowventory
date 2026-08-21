'use client';

import type { AbcClass } from '@/lib/reports/abc';
import { SegmentedControl } from '@/components/shared/trend-chart/SegmentedControl';
import { formatPrice } from '@/lib/currency';
import { AbcParetoBar } from './AbcParetoBar';
import {
  ABC_BADGE_CLASS,
  ABC_LABELS,
  ABC_LABELS_PROFIT,
  ANALYSIS_METRIC_OPTIONS,
  type AbcFilter,
  type AnalysisMetric,
} from './constants';

/** Ciro ve kâr özetlerinin ortak görünüm şekli — toggle refetch'siz swap yapar. */
export interface NormalizedAbcRow {
  class: AbcClass;
  productCount: number;
  /** Seçili metrikteki pay (ciro payı ya da kâr payı), 0..1. */
  share: number;
  stockValue: number;
}

interface AbcSectionProps {
  rows: NormalizedAbcRow[];
  metric: AnalysisMetric;
  onMetricChange: (metric: AnalysisMetric) => void;
  /** Kâr görünümünde alış fiyatı eksik ürün var mı? (~ notu) */
  hasProfitEstimate: boolean;
  selected: AbcFilter;
  onSelect: (cls: AbcClass) => void;
}

/**
 * ABC özet kartları — sınıf başına ürün sayısı, pay, bağlı stok.
 * Ciro|Kâr toggle'ı sınıflandırma tabanını değiştirir; kartlar tıklanınca
 * alttaki tabloyu o sınıfa filtreler (tekrar tıklama temizler).
 */
export function AbcSection({ rows, metric, onMetricChange, hasProfitEstimate, selected, onSelect }: AbcSectionProps) {
  const labels = metric === 'kar' ? ABC_LABELS_PROFIT : ABC_LABELS;
  const shareLabel = metric === 'kar' ? 'Kâr payı' : 'Ciro payı';

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">ABC Sınıflandırması</h2>
          <p className="text-xs text-muted-foreground">
            {metric === 'kar' ? 'Brüt kâr Pareto\'su' : 'Ciro Pareto\'su'}
            {metric === 'kar' && hasProfitEstimate ? ' · ~ alış fiyatı eksik ürünlerde kâr yaklaşık' : ''}
          </p>
        </div>
        <SegmentedControl
          options={ANALYSIS_METRIC_OPTIONS}
          value={metric}
          onChange={onMetricChange}
          aria-label="ABC sınıflandırma tabanı"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3">
        {rows.map(row => {
          const isSelected = selected === row.class;
          return (
            <button
              key={row.class}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(row.class)}
              className={`border-b border-r border-border p-5 text-left transition-colors last:border-b-0 md:border-b-0 md:last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                isSelected ? 'bg-muted' : 'hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${ABC_BADGE_CLASS[row.class]}`}>
                  {row.class}
                </span>
                <p className="text-sm font-medium text-foreground">{labels[row.class].title}</p>
              </div>
              <p className="mt-3 font-mono text-xl font-medium tabular-nums xl:text-2xl text-foreground">{row.productCount} ürün</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {shareLabel} %{(row.share * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ·
                bağlı stok {formatPrice(row.stockValue)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{labels[row.class].description}</p>
            </button>
          );
        })}
      </div>
      <AbcParetoBar rows={rows} metric={metric} />
    </section>
  );
}
