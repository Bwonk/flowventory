'use client';

import React, { useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StockHistoryApiResponse } from '@/app/api/stock-history/route';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { SegmentedControl } from '@/components/shared/trend-chart/SegmentedControl';
import { formatDateKey, formatNumber } from '@/lib/format';
import { buildProjection, VELOCITY_WINDOW_DAYS } from '@/lib/stock-history/projection';
import { InfoTip } from '@/components/shared/InfoTip';
import { shiftDateKey } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { StockWindowDays } from './hooks/use-stock-history';

/**
 * Stok Yolu — "bu stok beni kaç gün idare eder?" sorusunun grafiği.
 *
 * Geçmiş (StockHistory, 30/90G) düz accent çizgi; bugünden ileriye satış
 * hızıyla kesik projeksiyon; tükeniş noktası, tedarik süresi ve kritik eşik
 * işaretleri. StockEditor'daki taslak değer onaylanmadan soluk ikinci
 * projeksiyon olarak kayar — stok girişinin etkisi anında görünür.
 *
 * Tek seri + nötr projeksiyon: kategorik palet yok, tek accent (chart-1).
 */

const chartConfig = {
  history: { label: 'Stok', color: 'var(--chart-1)' },
  projection: { label: 'Tahmin', color: 'var(--muted-foreground)' },
  draft: { label: 'Taslak', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

type WindowValue = '30' | '90';
const WINDOW_OPTIONS: ReadonlyArray<{ value: WindowValue; label: string }> = [
  { value: '30', label: '30G' },
  { value: '90', label: '90G' },
];

interface ChartRow {
  date: string;
  history?: number;
  projection?: number;
  draft?: number;
}

/** Gün anahtarı → "16 Eyl" (yıl eksen etiketinde gereksiz). */
function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

interface HoverProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
}

function RunwayHover({ active, label, payload }: HoverProps) {
  if (!active || !label || !payload?.length) return null;
  const history = payload.find(p => p.dataKey === 'history');
  const projection = payload.find(p => p.dataKey === 'projection');
  const draft = payload.find(p => p.dataKey === 'draft');
  const rows: Array<{ key: string; value: number; note?: string; dashed?: boolean }> = [];
  if (history?.value !== undefined) rows.push({ key: 'h', value: Number(history.value) });
  if (projection?.value !== undefined && history?.value === undefined)
    rows.push({ key: 'p', value: Number(projection.value), note: 'tahmin', dashed: true });
  if (draft?.value !== undefined) rows.push({ key: 'd', value: Number(draft.value), note: 'taslak', dashed: true });
  if (rows.length === 0) return null;
  return (
    <div className="pointer-events-none rounded-md border border-hairline bg-popover px-2 py-1 font-mono text-[10px] shadow-sm">
      <p className="font-medium text-foreground">{formatDateKey(String(label)) ?? label}</p>
      {rows.map(r => (
        <p key={r.key} className="mt-0.5 flex items-center gap-1.5 text-foreground">
          <span
            aria-hidden
            className={cn('inline-block h-0 w-3 border-t-2', r.dashed ? 'border-dashed border-muted-foreground' : 'border-chart-1')}
          />
          <span className="tabular-nums">{formatNumber(r.value)} adet</span>
          {r.note && <span className="text-muted-foreground">{r.note}</span>}
        </p>
      ))}
    </div>
  );
}

export const StockRunwayChart: React.FC<{
  data: StockHistoryApiResponse | null;
  loading: boolean;
  error: boolean;
  /** StockEditor'daki onaylanmamış toplam (düzenleme yokken null). */
  draftStock: number | null;
  days: StockWindowDays;
  onDaysChange: (days: StockWindowDays) => void;
  className?: string;
}> = ({ data, loading, error, draftStock, days, onDaysChange, className }) => {
  const rows = useMemo<ChartRow[]>(() => {
    if (!data) return [];
    const byDate = new Map<string, ChartRow>();
    const upsert = (date: string, patch: Partial<ChartRow>) =>
      byDate.set(date, { ...(byDate.get(date) ?? { date }), ...patch });
    for (const p of data.history) upsert(p.date, { history: p.stock });
    for (const p of data.projection) upsert(p.date, { projection: p.stock });
    if (draftStock !== null && draftStock !== data.current) {
      const draft = buildProjection(draftStock, data.velocityPerDay, data.todayKey, 90);
      for (const p of draft.points) upsert(p.date, { draft: p.stock });
    }
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [data, draftStock]);

  const leadTimeKey = data ? shiftDateKey(data.todayKey, data.leadTimeDays) : null;
  const showLeadTime = Boolean(data && leadTimeKey && rows.some(r => r.date === leadTimeKey));
  const stockoutInView = Boolean(data?.stockoutDate && rows.some(r => r.date === data.stockoutDate));

  const summary = useMemo(() => {
    if (!data) return null;
    const velocityText = data.velocityPerDay.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
    if (data.current === 0) return 'Stok yok — projeksiyon bugünden başlıyor.';
    if (data.daysOfCover === null) return `${formatNumber(data.current)} adet · son 30 günde satış yok, projeksiyon yapılamıyor.`;
    const base = `${formatNumber(data.current)} adet, günde ~${velocityText} satışla ~${formatNumber(data.daysOfCover)} gün idare eder`;
    return data.stockoutBeforeLeadTime
      ? `${base} · tedarik ${data.leadTimeDays} gün — sipariş bugün verilse yetişmez.`
      : `${base} · tedarik ${data.leadTimeDays} gün.`;
  }, [data]);

  const yMax = useMemo(() => {
    let max = data?.criticalThreshold ?? 0;
    for (const r of rows) max = Math.max(max, r.history ?? 0, r.projection ?? 0, r.draft ?? 0);
    return Math.max(1, Math.ceil(max * 1.1));
  }, [rows, data]);

  // Eksen etiketleri: ilk, bugün, tükeniş/tedarik ve son — kalabalık değil.
  const ticks = useMemo(() => {
    if (!data || rows.length === 0) return undefined;
    const set = new Set<string>([rows[0].date, data.todayKey, rows[rows.length - 1].date]);
    if (stockoutInView && data.stockoutDate) set.add(data.stockoutDate);
    return Array.from(set).sort();
  }, [rows, data, stockoutInView]);

  return (
    <div className={cn('flex min-h-0 flex-col rounded-lg border border-hairline bg-card p-4', className)}>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">Stok Yolu</h3>
            {data && (
              <InfoTip
                size="sm"
                ariaPrefix="Stok Yolu"
                text={`Projeksiyon son ${VELOCITY_WINDOW_DAYS} günün ortalama günlük satışıyla (~${data.velocityPerDay.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} adet/gün) düz çizilir; satış yoksa yatay kalır.`}
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading ? 'Hesaplanıyor…' : error ? 'Stok geçmişi alınamadı.' : summary}
          </p>
        </div>
        <SegmentedControl
          aria-label="Geriye bakış penceresi"
          options={WINDOW_OPTIONS}
          value={String(days) as WindowValue}
          onChange={v => onDaysChange(Number(v) as StockWindowDays)}
        />
      </div>

      {data && rows.length > 0 ? (
        <div className="mt-3 h-[190px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
            <ComposedChart data={rows} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--hairline)" />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <YAxis
                domain={[0, yMax]}
                width={30}
                tickLine={false}
                axisLine={false}
                tickCount={3}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <Tooltip
                content={<RunwayHover />}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
              />
              {data.criticalThreshold > 0 && (
                <ReferenceLine
                  y={data.criticalThreshold}
                  stroke="var(--hairline)"
                  label={{ value: `KRİTİK ${data.criticalThreshold}`, position: 'insideTopLeft', fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                />
              )}
              <ReferenceLine
                x={data.todayKey}
                stroke="var(--border)"
                label={{ value: 'BUGÜN', position: 'top', fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
              />
              {showLeadTime && leadTimeKey && (
                <ReferenceLine
                  x={leadTimeKey}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  label={{ value: `TEDARİK ${data.leadTimeDays}G`, position: 'top', fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                />
              )}
              <Line
                type="stepAfter"
                dataKey="history"
                stroke="var(--color-history)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="projection"
                stroke="var(--color-projection)"
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive={false}
              />
              {draftStock !== null && (
                <Line
                  type="linear"
                  dataKey="draft"
                  stroke="var(--color-draft)"
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              {stockoutInView && data.stockoutDate && (
                <ReferenceDot
                  x={data.stockoutDate}
                  y={0}
                  r={4}
                  fill={data.stockoutBeforeLeadTime ? 'var(--status-critical)' : 'var(--muted-foreground)'}
                  stroke="var(--card)"
                  strokeWidth={2}
                  label={{
                    value: `TÜKENİŞ ~${shortDate(data.stockoutDate)}`,
                    position: 'top',
                    fill: data.stockoutBeforeLeadTime ? 'var(--status-critical)' : 'var(--muted-foreground)',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              )}
            </ComposedChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="mt-3 flex h-[190px] items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Yükleniyor…' : error ? 'Grafik çizilemedi.' : 'Henüz stok verisi yok.'}
          </p>
        </div>
      )}

      {data && data.history.length <= 1 && !loading && (
        <p className="mt-2 shrink-0 text-[11px] text-muted-foreground">
          Geçmiş toplanıyor
          {data.trackedSinceDays !== null ? ` · ${data.trackedSinceDays} gündür kayıt` : ''} — çizgi ilk stok hareketiyle uzar.
        </p>
      )}
    </div>
  );
};
