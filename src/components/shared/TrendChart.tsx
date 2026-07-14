'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip } from 'recharts';
import type { ChartConfig } from '@/components/evilcharts/ui/chart';
import { ChartContainer } from '@/components/evilcharts/ui/chart';
import { TR_MONTHS } from '@/components/home-page/constants';

export type ChartMetric = 'revenue' | 'quantity' | 'views';
export type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TrendDataPoint {
  date: string;
  revenue: number;
  quantity: number;
  views: number;
}

interface TrendChartProps {
  title: string;
  subtitle: string;
  data: TrendDataPoint[];
  metrics: ChartMetric[];
  defaultMetric?: ChartMetric;
  defaultPeriod?: ChartPeriod;
  emptyMessage?: string;
  height?: number;
}

const METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: 'Ciro',
  quantity: 'Satış Adedi',
  views: 'Görüntülenme',
};

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

const chartConfig = {
  revenue: { label: 'Ciro', colors: { light: ['#17171c'] as string[] } },
  quantity: { label: 'Satış Adedi', colors: { light: ['#6366f1'] as string[] } },
  views: { label: 'Görüntülenme', colors: { light: ['#10b981'] as string[] } },
} satisfies ChartConfig;

interface GroupedPoint {
  label: string;
  revenue: number;
  quantity: number;
  views: number;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getPeriodKey(dateStr: string, period: ChartPeriod): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';

  if (period === 'daily') return dateStr;
  if (period === 'weekly') {
    const weekday = (d.getDay() + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - weekday);
    return start.toISOString().split('T')[0];
  }
  if (period === 'monthly') return `${d.getFullYear()}-${d.getMonth()}`;
  return `${d.getFullYear()}`;
}

function groupByPeriod(data: TrendDataPoint[], period: ChartPeriod): GroupedPoint[] {
  const now = new Date();
  const dataMap = new Map<string, Pick<GroupedPoint, 'revenue' | 'quantity' | 'views'>>();

  for (const point of data) {
    const key = getPeriodKey(point.date, period);
    if (!key) continue;
    const existing = dataMap.get(key) ?? { revenue: 0, quantity: 0, views: 0 };
    existing.revenue += point.revenue;
    existing.quantity += point.quantity;
    existing.views += point.views;
    dataMap.set(key, existing);
  }

  const keysAndLabels: { key: string; label: string }[] = [];

  if (period === 'daily') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      keysAndLabels.push({ key, label: formatDayLabel(key) });
    }
  } else if (period === 'weekly') {
    const day = (now.getDay() + 6) % 7;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - day);
    currentWeekStart.setHours(0, 0, 0, 0);

    for (let i = 11; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - i * 7);
      const key = start.toISOString().split('T')[0];
      const weekNum = getISOWeek(start);
      keysAndLabels.push({ key, label: `H${weekNum}` });
    }
  } else if (period === 'monthly') {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    for (let i = 11; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      while (m < 0) { m += 12; y--; }
      const key = `${y}-${m}`;
      keysAndLabels.push({ key, label: `${TR_MONTHS[m]} ${String(y).slice(2)}` });
    }
  } else {
    const currentYear = now.getFullYear();
    for (let i = 4; i >= 0; i--) {
      const y = currentYear - i;
      const key = String(y);
      keysAndLabels.push({ key, label: key });
    }
  }

  return keysAndLabels.map(({ key, label }) => {
    const vals = dataMap.get(key) ?? { revenue: 0, quantity: 0, views: 0 };
    return { label, revenue: vals.revenue, quantity: vals.quantity, views: vals.views };
  });
}

function formatChartValue(value: number, metric: ChartMetric): string {
  if (metric === 'revenue') {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  }
  if (metric === 'views') {
    return `${value.toLocaleString('tr-TR')} görüntülenme`;
  }
  return `${value.toLocaleString('tr-TR')} adet`;
}

function formatSummary(value: number, metric: ChartMetric): string {
  if (metric === 'revenue') {
    return `Seçili dönemde toplam ₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ciro`;
  }
  if (metric === 'views') {
    return `Seçili dönemde toplam ${value.toLocaleString('tr-TR')} görüntülenme`;
  }
  return `Seçili dönemde toplam ${value.toLocaleString('tr-TR')} adet satış`;
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: ChartMetric;
}> = ({ active, payload, label, metric }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#ffffff] px-3 py-2 shadow-sm">
      <p className="text-xs text-[#75758a]">{label}</p>
      <p className="text-sm font-medium text-[#17171c]">{formatChartValue(payload[0].value, metric)}</p>
    </div>
  );
};

export const TrendChart: React.FC<TrendChartProps> = ({
  title,
  subtitle,
  data,
  metrics,
  defaultMetric,
  defaultPeriod,
  emptyMessage,
  height,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>(defaultMetric ?? metrics[0] ?? 'revenue');
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>(defaultPeriod ?? 'daily');

  const grouped = useMemo(() => groupByPeriod(data, selectedPeriod), [data, selectedPeriod]);

  const chartData = useMemo(
    () => grouped.map(g => ({ label: g.label, value: Math.round(g[selectedMetric]) })),
    [grouped, selectedMetric],
  );

  const totalValue = useMemo(
    () => grouped.reduce((s, g) => s + g[selectedMetric], 0),
    [grouped, selectedMetric],
  );

  const allZero = chartData.length === 0 || chartData.every(d => d.value === 0);
  const chartHeight = height ?? 260;

  if (!metrics.includes(selectedMetric)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-[#17171c]">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-[#75758a]">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-2">
          {metrics.length > 1 && (
            <div className="inline-flex gap-0.5 self-start rounded-full bg-[#f3f4f6] p-0.5">
              {metrics.map(m => {
                const active = selectedMetric === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMetric(m)}
                    className={`rounded-full px-2.5 py-1.5 text-xs transition-all duration-200 ${
                      active
                        ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                        : 'text-[#75758a] hover:text-[#17171c]'
                    }`}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                );
              })}
            </div>
          )}
          <div className="inline-flex gap-0.5 self-start rounded-full bg-[#f3f4f6] p-0.5">
            {PERIOD_OPTIONS.map(o => {
              const active = selectedPeriod === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSelectedPeriod(o.value)}
                  className={`rounded-full px-2.5 py-1.5 text-xs transition-all duration-200 ${
                    active
                      ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                      : 'text-[#75758a] hover:text-[#17171c]'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {allZero ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-[#75758a]">{emptyMessage ?? 'Bu dönem için henüz veri yok'}</p>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="10%">
            <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              content={<CustomTooltip metric={selectedMetric} />}
            />
            <Bar
              dataKey="value"
              fill={`var(--color-${selectedMetric}-0)`}
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
              minPointSize={2}
            />
          </BarChart>
        </ChartContainer>
      )}

      {!allZero && totalValue > 0 && (
        <div className="mt-4 border-t border-[#f3f4f6] pt-4">
          <p className="text-xs text-[#75758a]">{formatSummary(totalValue, selectedMetric)}</p>
        </div>
      )}
    </div>
  );
};
