'use client';

import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartMetric, ChartRange, DaySeriesPoint } from '../types';
import { METRIC_OPTIONS, RANGE_OPTIONS } from '../constants';
import { formatPrice } from '../lib/format';
import { groupSeries } from '../lib/analytics';

/** Aydınlık temalı özel tooltip. */
const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: ChartMetric;
}> = ({ active, payload, label, metric }) => {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  const labelText = metric === 'revenue' ? formatPrice(value) : metric === 'views' ? `${value} görüntülenme` : `${value} adet`;
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#ffffff] px-3 py-2 shadow-sm">
      <p className="text-[12px] text-[#75758a]">{label}</p>
      <p className="text-[14px] font-medium text-[#17171c]">{labelText}</p>
    </div>
  );
};

interface SalesChartProps {
  dailySeries: DaySeriesPoint[];
  soldCount: number;
  hasData: boolean;
  hasViews?: boolean;
  variantLabel: string;
}

/** Sağ panel satış grafiği: dönem/metrik anahtarları + alan grafiği + özet/boş durum. */
export const SalesChart: React.FC<SalesChartProps> = ({ dailySeries, soldCount, hasData, hasViews, variantLabel }) => {
  const [range, setRange] = useState<ChartRange>('daily');
  const [metric, setMetric] = useState<ChartMetric>('revenue');

  const grouped = useMemo(() => groupSeries(dailySeries, range), [dailySeries, range]);
  const chartData = useMemo(
    () =>
      grouped.map(g => ({
        label: g.label,
        value: metric === 'revenue' ? Math.round(g.revenue) : metric === 'views' ? Math.round(g.views) : Math.round(g.units),
      })),
    [grouped, metric],
  );
  const periodRevenue = useMemo(() => dailySeries.reduce((s, d) => s + d.revenue, 0), [dailySeries]);
  const totalViews = useMemo(() => dailySeries.reduce((s, d) => s + d.views, 0), [dailySeries]);

  return (
    <div className="flex w-full flex-1 flex-col rounded-xl border border-[#e5e7eb] bg-[#f8f9fa] p-5">
      {/* Üst satır: başlık + dönem sekmeleri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col">
          <p className="text-[14px] font-medium text-[#17171c]">Satış Grafiği</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
            {metric === 'views' ? 'Tüm Varyantlar' : variantLabel} · Son 30 Gün
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-full border border-[#e5e7eb] bg-[#ffffff] p-0.5">
          {RANGE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRange(o.value)}
              className={`rounded-full px-3 py-1 text-[12px] transition-colors duration-100 ${
                range === o.value ? 'bg-[#17171c] text-[#ffffff]' : 'text-[#75758a] hover:text-[#17171c]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrik anahtarı */}
      <div className="mt-3 inline-flex items-center gap-2">
        {METRIC_OPTIONS.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMetric(m.value)}
            className={`rounded-full px-3 py-1 text-[12px] transition-colors duration-100 ${
              metric === m.value
                ? 'bg-[#17171c] text-[#ffffff]'
                : 'border border-[#e5e7eb] text-[#75758a] hover:text-[#17171c]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {metric === 'views' ? (
        hasViews ? (
          <>
            <div className="mt-4 min-h-[200px] w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#17171c" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="#17171c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#75758a', fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <Tooltip
                    content={<ChartTooltip metric={metric} />}
                    cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#17171c"
                    strokeWidth={1.5}
                    fill="url(#lightGradient)"
                    dot={false}
                    activeDot={{ r: 3, fill: '#17171c', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 border-t border-[#e5e7eb] pt-3 text-[12px] text-[#75758a]">
              Seçili dönemde toplam{' '}
              <span className="font-medium text-[#17171c]">{totalViews}</span> görüntülenme
            </p>
          </>
        ) : (
          <div className="mt-4 flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] text-center">
            <p className="text-[14px] text-[#75758a]">Bu ürün için henüz görüntülenme verisi yok</p>
          </div>
        )
      ) : hasData ? (
        <>
          <div className="mt-4 min-h-[200px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#17171c" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#17171c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#75758a', fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <Tooltip
                  content={<ChartTooltip metric={metric} />}
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#17171c"
                  strokeWidth={1.5}
                  fill="url(#lightGradient)"
                  dot={false}
                  activeDot={{ r: 3, fill: '#17171c', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 border-t border-[#e5e7eb] pt-3 text-[12px] text-[#75758a]">
            Seçili dönemde toplam{' '}
            <span className="font-medium text-[#17171c]">{formatPrice(periodRevenue)}</span> ciro ·{' '}
            <span className="font-medium text-[#17171c]">{soldCount}</span> adet satış
          </p>
        </>
      ) : (
        <div className="mt-4 flex min-h-[200px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] text-center">
          <p className="text-[14px] text-[#75758a]">Bu ürün için henüz satış verisi yok</p>
        </div>
      )}
    </div>
  );
};
