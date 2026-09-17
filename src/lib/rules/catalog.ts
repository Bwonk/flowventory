/**
 * Metrik katalogu — form, açıklama cümlesi ve motor aynı kaynaktan beslenir.
 * Her metrik: hangi alanda yaşar, ne girdi ister, nasıl anlatılır, nasıl
 * değerlendirilir. Yeni koşul eklemek = buraya bir kayıt eklemek.
 */

import { agingBucket, AGING_BUCKET_ORDER, type AbcClass, type AgingBucketKey } from '@/lib/reports/abc';
import { ACTION_ORDER, deriveAction, type ActionKey } from '@/lib/reports/actions';
import { computePurchaseLine } from '@/lib/reports/purchase';
import { isStockoutBeforeLeadTime, sellThroughBand, type SellThroughBand } from '@/lib/reports/sell-through';
import { daysOfCover, velocityPerDay } from '@/lib/stock-history/projection';
import { shiftDateKey } from '@/lib/timezone';
import {
  RULE_METRICS,
  WINDOW_LABELS,
  type ConditionOf,
  type RuleCondition,
  type RuleDomain,
  type RuleMetric,
  type RuleTarget,
  type RuleWindowHours,
  type ThresholdUnit,
} from './types';

export type MetricInput =
  | {
      kind: 'number';
      units: readonly ThresholdUnit[];
      min: number;
      max: number;
      defaultValue: (ctx: DefaultContext) => number;
    }
  | { kind: 'enum'; options: ReadonlyArray<{ value: string; label: string }> }
  | { kind: 'none' };

export interface DefaultContext {
  leadTimeDays: number;
}

export interface MetricDef<M extends RuleMetric = RuleMetric> {
  metric: M;
  domain: RuleDomain;
  label: string;
  /** Formda metrik altında görünen açıklama. */
  hint: string;
  input: MetricInput;
  /** 'measure' → koşulun kendi ölçüm penceresi var (windowHours). */
  window: 'measure' | 'none';
  describe: (c: ConditionOf<M>) => string;
  /** Koşul sağlanıyorsa bildirim gövdesi (cümle), değilse null. */
  evaluate: (c: ConditionOf<M>, t: RuleTarget) => string | null;
}

export const UNIT_LABELS: Record<ThresholdUnit, string> = { units: 'adet', percent: '%', days: 'gün' };

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const windowLabel = (h: RuleWindowHours) => WINDOW_LABELS[h] ?? `${h} saat`;
const windowSentence = (h: RuleWindowHours) => (h < 48 ? `Son ${h} saatte` : `Son ${Math.ceil(h / 24)} günde`);

/** Satış pencereleri gün çözünürlüklü: 24s → bugün, 48s → dün+bugün, 7g → son 7 gün. */
export function windowStartDateKey(todayKey: string, windowHours: number): string {
  const days = Math.max(1, Math.ceil(windowHours / 24));
  return shiftDateKey(todayKey, -(days - 1));
}

function soldSince(t: RuleTarget, windowHours: RuleWindowHours): number {
  const fromKey = windowStartDateKey(t.todayKey, windowHours);
  let sum = 0;
  for (const [date, qty] of t.soldByDate) if (date >= fromKey) sum += qty;
  return sum;
}

function purchaseLine(t: RuleTarget) {
  return computePurchaseLine({
    dailyQuantities: t.dailyQuantities,
    currentStock: t.currentStock,
    leadTimeDays: t.leadTimeDays,
    targetStockDays: t.targetStockDays,
  });
}

function coverDays(t: RuleTarget): { velocity: number; cover: number | null } {
  const velocity = velocityPerDay(t.soldQty30);
  return { velocity, cover: daysOfCover(t.currentStock, velocity) };
}

const SELL_THROUGH_OPTIONS: ReadonlyArray<{ value: SellThroughBand; label: string }> = [
  { value: 'yüksek', label: 'Yüksek' },
  { value: 'normal', label: 'Normal' },
  { value: 'düşük', label: 'Düşük' },
  { value: 'satışsız', label: 'Satışsız' },
];
const ABC_OPTIONS: ReadonlyArray<{ value: AbcClass; label: string }> = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
];
const ACTION_LABELS: Record<ActionKey, string> = {
  'siparis-ver': 'Sipariş ver',
  'eritme-adayi': 'Eritme adayı',
  'fazla-stok': 'Fazla stok',
};
const AGING_OPTIONS: ReadonlyArray<{ value: AgingBucketKey; label: string }> = AGING_BUCKET_ORDER.map(b => ({
  value: b,
  label: b === 'satışsız' ? 'Satışsız' : `${b} gün`,
}));

export const METRIC_CATALOG: { [M in RuleMetric]: MetricDef<M> } = {
  stock_drop: {
    metric: 'stock_drop',
    domain: 'stok',
    label: 'Stok düşüşü',
    hint: 'Pencere başındaki stok ile şimdiki stok karşılaştırılır (izleme başladıktan sonra).',
    input: { kind: 'number', units: ['units', 'percent'], min: 1, max: 1_000_000, defaultValue: () => 10 },
    window: 'measure',
    describe: c =>
      c.thresholdUnit === 'percent'
        ? `${windowLabel(c.windowHours)} içinde stok %${fmt(c.threshold)} düşerse`
        : `${windowLabel(c.windowHours)} içinde stok ${fmt(c.threshold)} adet düşerse`,
    evaluate: (c, t) => {
      const previous = t.previousStockByWindow.get(c.windowHours) ?? null;
      if (previous === null) return null;
      const drop = previous - t.currentStock;
      if (drop <= 0) return null;
      const pct = previous > 0 ? Math.round((drop / previous) * 100) : null;
      const hit = c.thresholdUnit === 'percent' ? pct !== null && pct >= c.threshold : drop >= c.threshold;
      if (!hit) return null;
      return `${windowSentence(c.windowHours)} stok ${fmt(previous)} → ${fmt(t.currentStock)} (−${fmt(drop)} adet${pct !== null ? `, %${pct}` : ''}).`;
    },
  },
  stock_below: {
    metric: 'stock_below',
    domain: 'stok',
    label: 'Stok eşiğin altında',
    hint: 'Anlık stok eşiğin altındaysa.',
    input: { kind: 'number', units: ['units'], min: 1, max: 1_000_000, defaultValue: () => 5 },
    window: 'none',
    describe: c => `stok ${fmt(c.threshold)} adedin altına inerse`,
    evaluate: (c, t) => (t.currentStock < c.threshold ? `Stok ${fmt(t.currentStock)} adet — eşik ${fmt(c.threshold)}.` : null),
  },
  days_of_cover_below: {
    metric: 'days_of_cover_below',
    domain: 'stok',
    label: 'Stok ömrü kısa',
    hint: 'Son 30 günün satış hızıyla stoğun kaç gün yeteceği.',
    input: { kind: 'number', units: ['days'], min: 1, max: 730, defaultValue: ctx => Math.max(1, ctx.leadTimeDays) },
    window: 'none',
    describe: c => `stok ömrü ${fmt(c.threshold)} günün altına inerse`,
    evaluate: (c, t) => {
      const { velocity, cover } = coverDays(t);
      if (cover === null || cover >= c.threshold) return null;
      return `${fmt(t.currentStock)} adet, günde ~${fmt(velocity)} satış → ~${fmt(cover)} gün idare eder (eşik ${fmt(c.threshold)} gün).`;
    },
  },
  sales_above: {
    metric: 'sales_above',
    domain: 'stok',
    label: 'Satış eşiği aşıldı',
    hint: 'Penceredeki satış adedi (gün çözünürlüğü — 24/48 saat takvim günü sayılır).',
    input: { kind: 'number', units: ['units'], min: 1, max: 1_000_000, defaultValue: () => 20 },
    window: 'measure',
    describe: c => `${windowLabel(c.windowHours)} içinde satış ${fmt(c.threshold)} adedi geçerse`,
    evaluate: (c, t) => {
      const sold = soldSince(t, c.windowHours);
      return sold >= c.threshold ? `${windowSentence(c.windowHours)} ${fmt(sold)} adet satıldı (eşik ${fmt(c.threshold)}).` : null;
    },
  },
  no_sales: {
    metric: 'no_sales',
    domain: 'stok',
    label: 'Satış yok',
    hint: 'Pencere boyunca hiç satış yoksa ve stok varsa.',
    input: { kind: 'none' },
    window: 'measure',
    describe: c => `${windowLabel(c.windowHours)} boyunca satış olmazsa`,
    evaluate: (c, t) => {
      if (t.currentStock <= 0 || soldSince(t, c.windowHours) > 0) return null;
      return `${windowSentence(c.windowHours)} satış yok; ${fmt(t.currentStock)} adet stok bekliyor.`;
    },
  },
  reorder_point_reached: {
    metric: 'reorder_point_reached',
    domain: 'satinalma',
    label: 'Yeniden sipariş noktası',
    hint: 'Stok, tedarik süresi boyunca satışı karşılayacak seviyenin (emniyet stoğu dahil) altına indi.',
    input: { kind: 'none' },
    window: 'none',
    describe: () => 'yeniden sipariş noktasına gelirse',
    evaluate: (_c, t) => {
      const line = purchaseLine(t);
      if (!line.urgent) return null;
      return `Stok ${fmt(t.currentStock)} adet, yeniden sipariş noktası ${fmt(line.reorderPoint)} (öneri ${fmt(line.suggestedQty)} adet).`;
    },
  },
  below_safety_stock: {
    metric: 'below_safety_stock',
    domain: 'satinalma',
    label: 'Emniyet stoğunun altında',
    hint: 'Talep dalgalanması tamponunun (z × σ × √tedarik) altına indi.',
    input: { kind: 'none' },
    window: 'none',
    describe: () => 'emniyet stoğunun altına inerse',
    evaluate: (_c, t) => {
      const line = purchaseLine(t);
      if (line.dailyAvg <= 0 || line.safetyStock <= 0 || t.currentStock >= line.safetyStock) return null;
      return `Stok ${fmt(t.currentStock)} adet, emniyet stoğu ${fmt(line.safetyStock)}.`;
    },
  },
  suggested_qty_above: {
    metric: 'suggested_qty_above',
    domain: 'satinalma',
    label: 'Önerilen sipariş büyük',
    hint: 'Satın alma raporunun önerdiği sipariş adedi eşiği geçerse.',
    input: { kind: 'number', units: ['units'], min: 1, max: 1_000_000, defaultValue: () => 50 },
    window: 'none',
    describe: c => `önerilen sipariş ${fmt(c.threshold)} adedi geçerse`,
    evaluate: (c, t) => {
      const line = purchaseLine(t);
      return line.suggestedQty >= c.threshold ? `Önerilen sipariş ${fmt(line.suggestedQty)} adet (eşik ${fmt(c.threshold)}).` : null;
    },
  },
  stockout_before_lead_time: {
    metric: 'stockout_before_lead_time',
    domain: 'analiz',
    label: 'Tedarikten önce tükenir',
    hint: 'Sipariş bugün verilse mal gelmeden stok biter.',
    input: { kind: 'none' },
    window: 'none',
    describe: () => 'tedarik süresinden önce tükenecekse',
    evaluate: (_c, t) => {
      const { cover } = coverDays(t);
      if (!isStockoutBeforeLeadTime(cover, t.leadTimeDays)) return null;
      return `~${fmt(cover ?? 0)} gün stok kaldı, tedarik süresi ${fmt(t.leadTimeDays)} gün.`;
    },
  },
  sell_through_band_is: {
    metric: 'sell_through_band_is',
    domain: 'analiz',
    label: 'Sell-through bandı',
    hint: 'Son 30 günde satılan ÷ (satılan + kalan stok) oranının bandı.',
    input: { kind: 'enum', options: SELL_THROUGH_OPTIONS },
    window: 'none',
    describe: c => `sell-through ${labelOf(SELL_THROUGH_OPTIONS, c.value).toLocaleLowerCase('tr')} ise`,
    evaluate: (c, t) => {
      const band = sellThroughBand(t.soldQty30, t.currentStock);
      return band === c.value ? `Sell-through bandı: ${labelOf(SELL_THROUGH_OPTIONS, band)} (30 günde ${fmt(t.soldQty30)} satış, ${fmt(t.currentStock)} stok).` : null;
    },
  },
  aging_bucket_is: {
    metric: 'aging_bucket_is',
    domain: 'analiz',
    label: 'Yaşlandırma kovası',
    hint: 'Stoğun kaç günlük satışa denk geldiği; satışsız stok en riskli kova.',
    input: { kind: 'enum', options: AGING_OPTIONS },
    window: 'none',
    describe: c => `yaşlandırma ${labelOf(AGING_OPTIONS, c.value).toLocaleLowerCase('tr')} ise`,
    evaluate: (c, t) => {
      if (t.currentStock <= 0) return null;
      const { cover } = coverDays(t);
      const bucket = agingBucket(cover);
      return bucket === c.value ? `Yaşlandırma kovası: ${labelOf(AGING_OPTIONS, bucket)} (${fmt(t.currentStock)} adet stok).` : null;
    },
  },
  abc_class_is: {
    metric: 'abc_class_is',
    domain: 'analiz',
    label: 'ABC sınıfı',
    hint: 'Son 30 gün cirosuna göre mağaza geneli Pareto sınıfı (analiz sayfası 60 gün kullanır).',
    input: { kind: 'enum', options: ABC_OPTIONS },
    window: 'none',
    describe: c => `ABC sınıfı ${c.value} ise`,
    evaluate: (c, t) => (t.abcClass !== null && t.abcClass === c.value ? `ABC sınıfı: ${t.abcClass}.` : null),
  },
  action_is: {
    metric: 'action_is',
    domain: 'analiz',
    label: 'Aksiyon kuyruğu',
    hint: "Analiz sayfasındaki 'Bugün ne yapmalı?' kuyruğuna düşerse.",
    input: { kind: 'enum', options: ACTION_ORDER.map(a => ({ value: a, label: ACTION_LABELS[a] })) },
    window: 'none',
    describe: c => `aksiyon '${ACTION_LABELS[c.value]}' ise`,
    evaluate: (c, t) => {
      if (t.abcClass === null) return null;
      const { cover } = coverDays(t);
      const action = deriveAction(
        {
          abcClass: t.abcClass,
          totalStock: t.currentStock,
          soldQty: t.soldQty30,
          daysOfStock: cover,
          agingBucket: agingBucket(cover),
          stockoutBeforeLeadTime: isStockoutBeforeLeadTime(cover, t.leadTimeDays),
        },
        { targetStockDays: t.targetStockDays },
      );
      return action === c.value ? `Aksiyon: ${ACTION_LABELS[action]}.` : null;
    },
  },
};

function labelOf<T extends string>(options: ReadonlyArray<{ value: T; label: string }>, value: T | null): string {
  return options.find(o => o.value === value)?.label ?? String(value);
}

export const METRIC_LABELS: Record<RuleMetric, string> = Object.fromEntries(
  RULE_METRICS.map(m => [m, METRIC_CATALOG[m].label]),
) as Record<RuleMetric, string>;

export const METRICS_BY_DOMAIN: Record<RuleDomain, readonly RuleMetric[]> = {
  stok: RULE_METRICS.filter(m => METRIC_CATALOG[m].domain === 'stok'),
  satinalma: RULE_METRICS.filter(m => METRIC_CATALOG[m].domain === 'satinalma'),
  analiz: RULE_METRICS.filter(m => METRIC_CATALOG[m].domain === 'analiz'),
};

/** Metrik seçilince makul başlangıç koşulu (form). */
export function defaultCondition(metric: RuleMetric, ctx: DefaultContext): RuleCondition {
  const def = METRIC_CATALOG[metric];
  const windowHours: RuleWindowHours = 24;
  switch (metric) {
    case 'stock_drop':
      return { metric, threshold: numberDefault(def.input, ctx), thresholdUnit: 'units', windowHours };
    case 'stock_below':
    case 'days_of_cover_below':
    case 'suggested_qty_above':
      return { metric, threshold: numberDefault(def.input, ctx) };
    case 'sales_above':
      return { metric, threshold: numberDefault(def.input, ctx), windowHours: 168 };
    case 'no_sales':
      return { metric, windowHours: 720 };
    case 'reorder_point_reached':
    case 'below_safety_stock':
    case 'stockout_before_lead_time':
      return { metric };
    case 'sell_through_band_is':
      return { metric, value: 'düşük' };
    case 'aging_bucket_is':
      return { metric, value: '180+' };
    case 'abc_class_is':
      return { metric, value: 'C' };
    case 'action_is':
      return { metric, value: 'siparis-ver' };
  }
}

function numberDefault(input: MetricInput, ctx: DefaultContext): number {
  return input.kind === 'number' ? input.defaultValue(ctx) : 0;
}

// Katalog girdileri metriğe özel tiplenir; ortak dispatch için gevşek görünüm.
type AnyMetricDef = {
  describe: (c: RuleCondition) => string;
  evaluate: (c: RuleCondition, t: RuleTarget) => string | null;
};

export function describeCondition(c: RuleCondition): string {
  return (METRIC_CATALOG[c.metric] as unknown as AnyMetricDef).describe(c);
}

export function evaluateCondition(c: RuleCondition, t: RuleTarget): string | null {
  return (METRIC_CATALOG[c.metric] as unknown as AnyMetricDef).evaluate(c, t);
}
