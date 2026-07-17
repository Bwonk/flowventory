'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Bar, BarChart, XAxis, YAxis, Tooltip } from 'recharts';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import type { ChartConfig } from '@/components/evilcharts/ui/chart';
import { ChartContainer } from '@/components/evilcharts/ui/chart';
import { BarShape } from '@/components/evilcharts/blocks/monospace-bar-chart';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TR_MONTHS } from '@/components/home-page/constants';
import type { ChartMetric } from '@/components/home-page/types';

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
}

const METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: 'Ciro',
  quantity: 'Satış Adedi',
  views: 'Görüntülenme',
};

// Quick range presets shown at the top of the date dropdown.
const QUICK_RANGES: { value: ChartPeriod; label: string }[] = [
  { value: 'last24h', label: 'Son 24 Saat' },
  { value: 'last7d', label: 'Son 7 Gün' },
  { value: 'last30d', label: 'Son 30 Gün' },
  { value: 'last1y', label: 'Son 1 Yıl' },
];

const chartConfig = {
  revenue: { label: 'Ciro', colors: { light: ['#17171c'] as string[] } },
  quantity: { label: 'Satış Adedi', colors: { light: ['#6366f1'] as string[] } },
  views: { label: 'Görüntülenme', colors: { light: ['#10b981'] as string[] } },
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
    return prefix + ' toplam ₺' + value.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ciro';
  }
  if (metric === 'views') {
    return prefix + ' toplam ' + value.toLocaleString('tr-TR') + ' görüntülenme';
  }
  return prefix + ' toplam ' + value.toLocaleString('tr-TR') + ' adet satış';
}

// Props injected by recharts into a custom Tooltip content element.
interface DateHoverLabelProps {
  active?: boolean;
  label?: string | number;
}

// Lightweight date-only chip shown on hover. The metric value is already
// rendered above the bar by BarShape, so this only identifies the date.
function DateHoverLabel({ active, label }: DateHoverLabelProps) {
  if (!active || label === undefined || label === '') return null;
  return (
    <div className="pointer-events-none rounded-md border border-[#e5e7eb] bg-[#ffffff] px-2 py-0.5 text-[10px] font-medium text-[#17171c] shadow-sm">
      {label}
    </div>
  );
}

// Resolve the start/end bounds for daily-granularity periods.
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
  // last30d (default daily window)
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
}) => {
  const [metric, setMetric] = useState<ChartMetric>(defaultMetric ?? metrics[0] ?? 'revenue');
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod ?? 'last30d');
  const [hourlyData, setHourlyData] = useState<HourlyPoint[] | null>(null);
  const [hourlyViews, setHourlyViews] = useState<Array<{ hour: number; label: string; viewCount: number }> | null>(null);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  // Committed custom range (only meaningful when period === 'custom').
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>();
  // Working range edited inside the dropdown before Uygula.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);
  // Two months on desktop, one on narrow/mobile layouts.
  const [monthsToShow, setMonthsToShow] = useState(2);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 0);
      // 1px tolerance for rounding errors
      setShowRightFade(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Small timeout to ensure DOM is fully painted
      setTimeout(() => {
        if (scrollRef.current) {
          const activeBtn = scrollRef.current.querySelector('[aria-selected="true"]') as HTMLButtonElement | null;
          if (activeBtn) {
            // Scroll active button into view if it's not fully visible
            const container = scrollRef.current;
            const btnLeft = activeBtn.offsetLeft - container.offsetLeft;
            const btnRight = btnLeft + activeBtn.offsetWidth;
            
            if (btnLeft < container.scrollLeft) {
              container.scrollLeft = btnLeft - 8;
            } else if (btnRight > container.scrollLeft + container.clientWidth) {
              container.scrollLeft = btnRight - container.clientWidth + 8;
            }
          }
        }
        handleScroll();
      }, 0);
    }
  }, [open, handleScroll, period]);

  useEffect(() => {
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setMonthsToShow(mq.matches ? 2 : 1);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Quick ranges available in this instance (respects hourly support + modal restrictions).
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
      const today = new Date().toISOString().split('T')[0];
      hourlyFetch(today).then(setHourlyData).finally(() => setHourlyLoading(false));
    }
  }, [period, metric, hourlyFetch]);

  useEffect(() => {
    if (period === 'last24h' && metric === 'views' && hourlyViewFetch) {
      setHourlyLoading(true);
      const today = new Date().toISOString().split('T')[0];
      hourlyViewFetch(today).then(setHourlyViews).finally(() => setHourlyLoading(false));
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
  }, [period, data, effectiveMetric, hourlyData, appliedRange]);

  const totalValue = useMemo(
    () => chartData.reduce((s, d) => s + d.value, 0),
    [chartData],
  );

  const hasNoDataAtAll = chartData.length === 0;
  const isAllZero = chartData.length > 0 && chartData.every(d => d.value === 0);
  const chartHeight = height ?? 260;

  const xAxisInterval = period === 'last24h' ? 2 : chartData.length > 15 ? 4 : 0;

  // Label shown on the dropdown trigger for the active range.
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

  // Apply a quick preset immediately and close the dropdown.
  const selectQuickRange = useCallback((value: ChartPeriod) => {
    setPeriod(value);
    setAppliedRange(undefined);
    setDraftRange(undefined);
    setOpen(false);
  }, []);

  // Commit the drafted custom range.
  const applyCustomRange = useCallback(() => {
    if (!draftRange?.from || !draftRange?.to) return;
    setAppliedRange(draftRange);
    setPeriod('custom');
    setOpen(false);
  }, [draftRange]);

  // Sync the draft with the committed range whenever the dropdown opens.
  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setDraftRange(appliedRange);
    setOpen(next);
  }, [appliedRange]);

  const canApplyCustom = Boolean(draftRange?.from && draftRange?.to);

  // Live feedback for the draft selection inside the open popover.
  const draftFromLabel = draftRange?.from
    ? format(draftRange.from, 'd MMM yyyy', { locale: tr })
    : null;
  const draftToLabel = draftRange?.to
    ? format(draftRange.to, 'd MMM yyyy', { locale: tr })
    : null;

  return (
    <div className={cn(
      layout === 'default' && "rounded-2xl border border-border bg-card p-6 flex flex-col",
      layout === 'modal' && "p-6 md:p-0 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]"
    )}>
      <div className={cn(
        "mb-5 flex flex-wrap gap-4",
        layout === 'default' ? "shrink-0 items-start justify-between" : "min-w-0 flex-col md:flex-row md:items-start md:justify-between"
      )}>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className={cn(
          "flex flex-col gap-2",
          layout === 'default' ? "items-end" : "max-md:items-start max-md:w-full items-end"
        )}>
          {availableMetrics.length > 1 && (
            <div className="inline-flex gap-0.5 rounded-2xl bg-[#f3f4f6] p-1">
            {availableMetrics.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={effectiveMetric === m}
                className={cn(
                  'rounded-2xl px-3 h-9 text-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17171c] focus-visible:ring-offset-1',
                  effectiveMetric === m
                    ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                    : 'text-muted-foreground hover:text-[#17171c]',
                )}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        )}

        {quickRanges.length > 0 && (
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                aria-label="Tarih aralığı seç"
                aria-expanded={open}
                className={cn(
                  'rounded-2xl h-9 gap-1.5 px-3 text-xs font-normal text-[#17171c]',
                  period === 'custom' && 'border-[#17171c] bg-[#f3f4f6]',
                )}
              >
                <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{triggerLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              container={portalContainer ?? undefined}
              align="end" 
              sideOffset={6} 
              className="z-[100] w-auto max-w-[calc(100vw-1rem)] rounded-lg p-4"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {/* SECTION 1 — Quick ranges */}
              <div className="relative">
                {/* Left Blur */}
                <div
                  className={cn(
                    'pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-6 bg-gradient-to-r from-[#ffffff] to-transparent transition-opacity duration-200',
                    showLeftFade ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {/* Right Blur */}
                <div
                  className={cn(
                    'pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-6 bg-gradient-to-l from-[#ffffff] to-transparent transition-opacity duration-200',
                    showRightFade ? 'opacity-100' : 'opacity-0'
                  )}
                />
                
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex gap-0.5 overflow-x-auto scroll-smooth rounded-2xl bg-[#f3f4f6] p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  role="listbox"
                  aria-label="Hızlı aralıklar"
                >
                  {quickRanges.map(r => {
                    const active = period === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectQuickRange(r.value)}
                        className={cn(
                          'flex h-9 shrink-0 items-center justify-center rounded-2xl px-4 text-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17171c] focus-visible:ring-offset-1',
                          active
                            ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                            : 'font-medium text-muted-foreground hover:text-[#17171c]'
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {showCustom && (
                <>
                  {/* DIVIDER */}
                  <div className="my-4 -mx-4 border-t border-[#e5e7eb]" />

                  {/* SECTION 2 — Custom range */}
                  <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    ÖZEL ARALIK
                  </p>
                  {/* Live draft selection feedback */}
                  <div className="mb-2" aria-live="polite">
                    {!draftFromLabel ? (
                      <p className="text-xs text-muted-foreground">Tarih aralığı seçin</p>
                    ) : !draftToLabel ? (
                      <div className="flex gap-1 text-xs">
                        <span className="text-[#17171c]">Başlangıç: {draftFromLabel}</span>
                        <span className="text-[#e5e7eb]">|</span>
                        <span className="text-muted-foreground">Bitiş tarihini seçin</span>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-[#17171c]">
                        {draftFromLabel} – {draftToLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <Calendar
                      mode="range"
                      selected={draftRange}
                      onSelect={(nextRange) => setDraftRange(nextRange)}
                      defaultMonth={draftRange?.from ?? appliedRange?.from}
                      numberOfMonths={monthsToShow}
                      showOutsideDays
                      locale={tr}
                      className="p-0"
                      classNames={{
                        weekday: 'flex-1 rounded-md text-[0.8rem] font-medium text-muted-foreground select-none',
                        month: 'flex w-full flex-col gap-3',
                      }}
                    />
                  </div>
                  <div className="mt-3 -mx-4 border-t border-[#e5e7eb] px-4 pt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenChange(false)}
                      className="inline-flex h-9 items-center rounded-2xl px-3 text-xs font-medium text-[#374151] transition-colors hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17171c] focus-visible:ring-offset-1"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={applyCustomRange}
                      disabled={!canApplyCustom}
                      className="inline-flex h-9 items-center rounded-2xl bg-[#17171c] px-4 text-xs font-medium text-[#ffffff] transition-colors hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-[#17171c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17171c] focus-visible:ring-offset-1"
                    >
                      Uygula
                    </button>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
          )}
        </div>
      </div>

      {hourlyLoading ? (
        <div className={cn("flex items-center justify-center py-10", layout === 'modal' ? "min-h-0 overflow-hidden" : "min-h-[160px]")}>
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        </div>
      ) : hasNoDataAtAll || isAllZero ? (
        <div className={cn("flex flex-col items-center justify-center py-10 text-center", layout === 'modal' ? "min-h-0 overflow-hidden" : "min-h-[160px]")}>
          <p className="text-sm font-medium text-foreground">
            {effectiveMetric === 'revenue' && 'Bu dönemde ciro verisi bulunmuyor.'}
            {effectiveMetric === 'quantity' && 'Bu dönemde satış verisi bulunmuyor.'}
            {effectiveMetric === 'views' && 'Bu dönemde görüntülenme verisi bulunmuyor.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Farklı bir tarih aralığı veya varyant seçebilirsiniz.</p>
        </div>
      ) : (
        <div className={cn("w-full", layout === 'modal' && "min-h-0 overflow-hidden")} style={layout === 'default' ? { height: chartHeight } : undefined}>
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
              tick={{ fill: '#9ca3af', fontSize: 10 }}
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
              fill={'var(--color-' + effectiveMetric + '-0)'}
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
        <div className={cn("mt-4 border-t border-[#f3f4f6] pt-4", layout === 'modal' && "shrink-0 border-border")}>
          <p className="text-xs text-muted-foreground">{formatSummary(totalValue, effectiveMetric, period)}</p>
        </div>
      )}
    </div>
  );
};
