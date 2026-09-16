/**
 * Kural tabanlı takip — sabitler ve tipler (istemci + sunucu ortak, saf).
 */

export const RULE_SCOPES = ['all', 'product', 'vendor'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export const RULE_METRICS = ['stock_drop', 'stock_below', 'days_of_cover_below', 'sales_above', 'no_sales'] as const;
export type RuleMetric = (typeof RULE_METRICS)[number];

export const THRESHOLD_UNITS = ['units', 'percent', 'days'] as const;
export type ThresholdUnit = (typeof THRESHOLD_UNITS)[number];

export const RULE_WINDOWS = [24, 48, 168, 720, 2160] as const;
export type RuleWindowHours = (typeof RULE_WINDOWS)[number];

export const WINDOW_LABELS: Record<RuleWindowHours, string> = {
  24: '24 saat',
  48: '48 saat',
  168: '7 gün',
  720: '30 gün',
  2160: '90 gün',
};

export const METRIC_LABELS: Record<RuleMetric, string> = {
  stock_drop: 'Stok düşüşü',
  stock_below: 'Stok eşiğin altında',
  days_of_cover_below: 'Stok ömrü kısa',
  sales_above: 'Satış eşiği aşıldı',
  no_sales: 'Satış yok',
};

export const SCOPE_LABELS: Record<RuleScope, string> = {
  all: 'Tüm ürünler',
  product: 'Ürün',
  vendor: 'Tedarikçi',
};

/** Metrik için pencerenin anlamı — formda ve açıklamada kullanılır. */
export const WINDOW_ROLE: Record<RuleMetric, 'measure' | 'cooldown'> = {
  stock_drop: 'measure',
  sales_above: 'measure',
  no_sales: 'measure',
  stock_below: 'cooldown',
  days_of_cover_below: 'cooldown',
};

export function isRuleScope(v: unknown): v is RuleScope {
  return typeof v === 'string' && (RULE_SCOPES as readonly string[]).includes(v);
}
export function isRuleMetric(v: unknown): v is RuleMetric {
  return typeof v === 'string' && (RULE_METRICS as readonly string[]).includes(v);
}
export function isThresholdUnit(v: unknown): v is ThresholdUnit {
  return typeof v === 'string' && (THRESHOLD_UNITS as readonly string[]).includes(v);
}
export function isRuleWindow(v: unknown): v is RuleWindowHours {
  return typeof v === 'number' && (RULE_WINDOWS as readonly number[]).includes(v);
}

/** Motorun ve açıklamanın ihtiyaç duyduğu kural alt kümesi (DB satırı veya form taslağı). */
export interface TrackingRuleLike {
  id: string;
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  metric: RuleMetric;
  threshold: number;
  thresholdUnit: ThresholdUnit;
  windowHours: RuleWindowHours;
}
