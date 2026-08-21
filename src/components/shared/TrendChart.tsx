'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { BarShape } from '@/components/shared/trend-chart/BarShape';
import { SegmentedControl } from '@/components/shared/trend-chart/SegmentedControl';
import { DateRangePicker } from '@/components/shared/trend-chart/DateRangePicker';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { formatPrice } from '@/lib/currency';
import { formatNumber } from '@/lib/format';
import { TR_MONTHS } from '@/lib/products/constants';
import type { ChartMetric } from '@/lib/products/types';

export type ChartPeriod =
  | 'last24h'
  | 'last7d'
  | 'last30d'
  | 'thisMonth'
  | 'last1y'
  | 'custom';

export interface TrendDataPoint {
  date: string;
  revenue: number;
  quantity: number;
  views: number;
}

export interface HourlyPoint {
  hour: number;
  label: string;
  revenue: number;
  quantity: number;
}

interface TrendChartProps {
  title: string;
  subtitle: string;
  data: TrendDataPoint[];
  metrics: ChartMetric[];
  hourlyFetch?: (date: string) => Promise<HourlyPoint[]>;
  hourlyViewFetch?: (date: string) => Promise<Array<{ hour: number; label: string; viewCount: number }>>;
  availablePeriods?: ChartPeriod[];
  defaultMetric?: ChartMetric;
  defaultPeriod?: ChartPeriod;
  height?: number;
  layout?: 'default' | 'modal';
  portalContainer?: HTMLElement | null;
  /** Boş durumdaki ikincil ipucu satırı (bağlama göre değişir: varyantlı sayfa vs dashboard). */
  emptyHint?: string;
}

const METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: 'Ciro',
  quantity: 'Satış Adedi',
  views: 'Görüntülenme',
};

// Tarih seçicinin üstündeki hızlı aralık ön ayarları.
const QUICK_RANGES: { value: ChartPeriod; label: string }[] = [
  { value: 'last24h', label: 'Son 24 Saat' },
  { value: 'last7d', label: 'Son 7 Gün' },
  { value: 'last30d', label: 'Son 30 Gün' },
  { value: 'last1y', label: 'Son 1 Yıl' },
];

// Palet yalnızca --chart-* token'larından (DESIGN.md §5); chart-1 = accent.
const chartConfig = {
  revenue: { label: 'Ciro', color: 'var(--chart-1)' },
  quantity: { label: 'Satış Adedi', color: 'var(--chart-2)' },
  views: { label: 'Görüntülenme', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '.' + mm;
}

function formatSummary(value: number, metric: ChartMetric, period: ChartPeriod): string {
  const prefix = period === 'last24h' ? 'Seçili günde' : 'Seçili dönemde';
  if (metric === 'revenue') {
    return prefix + ' toplam ' + formatPrice(value) + ' ciro';
  }
  if (metric === 'views') {
    return prefix + ' toplam ' + formatNumber(value) + ' görüntülenme';
  }
  return prefix + ' toplam ' + formatNumber(value) + ' adet satış';
}

// recharts'ın custom Tooltip content elemanına enjekte ettiği props.
interface DateHoverLabelProps {
  active?: boolean;
  label?: string | number;
}

// Hover'da yalnızca tarihi gösteren hafif çip; metrik değeri BarShape zaten
// barın üstüne çiziyor.
function DateHoverLabel({ active, label }: DateHoverLabelProps) {
  if (!active || label === undefined || label === '') return null;
  return (
    <div className="pointer-events-none rounded-md border border-hairline bg-popover px-2 py-0.5 font-mono text-[10px] font-medium text-foreground shadow-sm">
      {label}
    </div>
  );
}

// Günlük granülerlikteki dönemler için başlangıç/bitiş sınırları.
function getDailyBounds(period: ChartPeriod, applied: DateRange | undefined): { from: Date; to: Date } {
  const now = new Date();
  if (period === 'custom' && applied?.from && applied?.to) {
    return { from: applied.from, to: applied.to };
  }
  if (period === 'last7d') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { from, to: now };
  }
  if (period === 'thisMonth') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  // last30d (varsayılan günlük pencere)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return { from, to: now };
}

const DAILY_PERIODS: ChartPeriod[] = ['last7d', 'last30d', 'thisMonth', 'custom'];

export const TrendChart: React.FC<TrendChartProps> = ({
  title,
  subtitle,
  data,
  metrics,
  hourlyFetch,
  hourlyViewFetch,
  availablePeriods: periodFilter,
  defaultMetric,
  defaultPeriod,
  height,
  layout = 'default',
  portalContainer,
  emptyHint = 'Farklı bir tarih aralığı veya varyant seçebilirsiniz.',
}) => {
  const [metric, setMetric] = useState<ChartMetric>(defaultMetric ?? metrics[0] ?? 'revenue');
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod ?? 'last30d');
  const [hourlyData, setHourlyData] = useState<HourlyPoint[] | null>(null);
  const [hourlyViews, setHourlyViews] = useState<Array<{ hour: number; label: string; viewCount: number }> | null>(null);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyError, setHourlyError] = useState(false);
  // Uygulanmış özel aralık (yalnızca period === 'custom' iken anlamlı).
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>();

  // Bu örnekte kullanılabilir hızlı aralıklar (saatlik destek + filtre).
  const quickRanges = useMemo(() => {
    let filtered = QUICK_RANGES;
    if (!hourlyFetch) filtered = filtered.filter(r => r.value !== 'last24h');
    if (periodFilter) filtered = filtered.filter(r => periodFilter.includes(r.value));
    return filtered;
  }, [hourlyFetch, periodFilter]);

  const showCustom = !periodFilter || periodFilter.includes('custom');

  const availableMetrics = metrics;

  const effectiveMetric = availableMetrics.includes(metric) ? metric : availableMetrics[0] ?? 'revenue';

  useEffect(() => {
    if (!availableMetrics.includes(metric) && availableMetrics.length > 0) {
      setMetric(availableMetrics[0]);
    }
  }, [availableMetrics, metric]);

  useEffect(() => {
    if (period === 'last24h' && metric !== 'views' && hourlyFetch) {
      setHourlyLoading(true);
      setHourlyError(false);
      const today = new Date().toISOString().split('T')[0];
      hourlyFetch(today)
        .then(setHourlyData)
        .catch(error => {
          logger.error('Saatlik satış verisi alınamadı', { error });
          setHourlyData([]);
          setHourlyError(true);
        })
        .finally(() => setHourlyLoading(false));
    }
  }, [period, metric, hourlyFetch]);

  useEffect(() => {
    if (period === 'last24h' && metric === 'views' && hourlyViewFetch) {
      setHourlyLoading(true);
      setHourlyError(false);
      const today = new Date().toISOString().split('T')[0];
      hourlyViewFetch(today)
        .then(setHourlyViews)
        .catch(error => {
          logger.error('Saatlik görüntülenme verisi alınamadı', { error });
          setHourlyViews([]);
          setHourlyError(true);
        })
        .finally(() => setHourlyLoading(false));
    }
  }, [period, metric, hourlyViewFetch]);

  const chartData = useMemo(() => {
    if (period === 'last24h') {
      if (effectiveMetric === 'views') {
        return (hourlyViews ?? []).map(h => ({
          label: h.label,
          value: h.viewCount,
        }));
      }
      return (hourlyData ?? []).map(h => ({
        label: h.label,
        value: Math.round(effectiveMetric === 'revenue' ? h.revenue : h.quantity),
      }));
    }

    if (DAILY_PERIODS.includes(period)) {
      const { from, to } = getDailyBounds(period, appliedRange);

      const dataMap = new Map<string, number>();
      for (const point of data) {
        const val = point[effectiveMetric];
        dataMap.set(point.date, (dataMap.get(point.date) ?? 0) + val);
      }

      const result: { label: string; value: number }[] = [];
      const current = new Date(from);
      while (current <= to) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        result.push({
          label: formatDayLabel(key),
          value: Math.round(dataMap.get(key) ?? 0),
        });
        current.setDate(current.getDate() + 1);
      }
      return result;
    }

    if (period === 'last1y') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const dataMap = new Map<string, number>();
      for (const point of data) {
        const [yearStr, monthStr] = point.date.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10) - 1;
        const key = y + '-' + m;
        dataMap.set(key, (dataMap.get(key) ?? 0) + point[effectiveMetric]);
      }

      const result: { label: string; value: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) { m += 12; y--; }
        const key = y + '-' + m;
        result.push({
          label: TR_MONTHS[m] + ' ' + String(y).slice(2),
          value: Math.round(dataMap.get(key) ?? 0),
        });
      }
      return result;
    }

    return [];
    // hourlyViews: 24s + "görüntülenme" seçiliyken veri asenkron geliyor;
    // bağımlılıkta olmazsa yüklenen saatlik veri grafiğe yansımıyordu.
  }, [period, data, effectiveMetric, hourlyData, hourlyViews, appliedRange]);

  const totalValue = useMemo(
    () => chartData.reduce((s, d) => s + d.value, 0),
    [chartData],
  );

  const hasNoDataAtAll = chartData.length === 0;
  const isAllZero = chartData.length > 0 && chartData.every(d => d.value === 0);
  const chartHeight = height ?? 260;

  const xAxisInterval = period === 'last24h' ? 2 : chartData.length > 15 ? 4 : 0;

  // Tarih seçici tetikleyicisinde görünen etiket.
  const triggerLabel = useMemo(() => {
    if (period === 'custom' && appliedRange?.from) {
      if (appliedRange.to) {
        return (
          format(appliedRange.from, 'dd MMM yyyy', { locale: tr }) +
          ' – ' +
          format(appliedRange.to, 'dd MMM yyyy', { locale: tr })
        );
      }
      return format(appliedRange.from, 'dd MMM yyyy', { locale: tr });
    }
    return quickRanges.find(r => r.value === period)?.label
      ?? QUICK_RANGES.find(r => r.value === period)?.label
      ?? 'Tarih aralığı';
  }, [period, appliedRange, quickRanges]);

  const selectQuickRange = useCallback((value: ChartPeriod) => {
    setPeriod(value);
    setAppliedRange(undefined);
  }, []);

  const applyCustomRange = useCallback((range: DateRange) => {
    setAppliedRange(range);
    setPeriod('custom');
  }, []);

  return (
    <div className={cn(
      layout === 'default' && 'flex flex-col rounded-lg border border-hairline bg-card p-5',
      layout === 'modal' && 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] p-6 md:p-0',
    )}>
      <div className={cn(
        'mb-5 flex flex-wrap gap-4',
        layout === 'default' ? 'shrink-0 items-start justify-between' : 'min-w-0 flex-col md:flex-row md:items-start md:justify-between',
      )}>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className={cn(
          'flex flex-col gap-2',
          layout === 'default' ? 'items-end' : 'items-end max-md:w-full max-md:items-start',
        )}>
          {availableMetrics.length > 1 && (
            <SegmentedControl
              aria-label="Metrik seç"
              options={availableMetrics.map(m => ({ value: m, label: METRIC_LABELS[m] }))}
              value={effectiveMetric}
              onChange={setMetric}
            />
          )}

          {quickRanges.length > 0 && (
            <DateRangePicker
              quickRanges={quickRanges}
              period={period}
              appliedRange={appliedRange}
              triggerLabel={triggerLabel}
              showCustom={showCustom}
              portalContainer={portalContainer}
              onSelectQuick={selectQuickRange}
              onApplyCustom={applyCustomRange}
            />
          )}
        </div>
      </div>

      {hourlyLoading ? (
        <div className={cn('flex items-center justify-center py-10', layout === 'modal' ? 'min-h-0 overflow-hidden' : 'min-h-[160px]')}>
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        </div>
      ) : hasNoDataAtAll || isAllZero ? (
        <div className={cn('flex flex-col items-center justify-center py-10 text-center', layout === 'modal' ? 'min-h-0 overflow-hidden' : 'min-h-[160px]')}>
          {hourlyError && period === 'last24h' ? (
            <p className="text-sm font-medium text-foreground">Saatlik veri alınamadı.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {effectiveMetric === 'revenue' && 'Bu dönemde ciro verisi bulunmuyor.'}
                {effectiveMetric === 'quantity' && 'Bu dönemde satış verisi bulunmuyor.'}
                {effectiveMetric === 'views' && 'Bu dönemde görüntülenme verisi bulunmuyor.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
            </>
          )}
        </div>
      ) : (
        <div className={cn('w-full', layout === 'modal' && 'min-h-0 overflow-hidden')} style={layout === 'default' ? { height: chartHeight } : undefined}>
          <ChartContainer
            config={chartConfig}
            className="h-full w-full"
          >
          <BarChart data={chartData} margin={{ top: 30, right: 8, bottom: 0, left: 8 }} barCategoryGap="10%">
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={xAxisInterval}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            />
            <YAxis
              hide
              domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]}
            />
            <Tooltip
              content={<DateHoverLabel />}
              offset={12}
              isAnimationActive={false}
              wrapperStyle={{ outline: 'none' }}
            />
            <Bar
              dataKey="value"
              fill={'var(--color-' + effectiveMetric + ')'}
              shape={<BarShape />}
              activeBar={<BarShape />}
              maxBarSize={24}
              minPointSize={2}
            />
          </BarChart>
        </ChartContainer>
        </div>
      )}

      {!hasNoDataAtAll && !isAllZero && totalValue > 0 && (
        <div className={cn('mt-4 border-t border-hairline pt-4', layout === 'modal' && 'shrink-0')}>
          <p className="text-xs text-muted-foreground">{formatSummary(totalValue, effectiveMetric, period)}</p>
        </div>
      )}
    </div>
  );
};
