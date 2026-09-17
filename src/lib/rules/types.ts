/**
 * Kural tabanlı takip — sabitler ve tipler (istemci + sunucu ortak, saf).
 *
 * v2 (17 Eyl 2026): kural = kapsam + alan + kanal + [koşullar] (tek bağlaç) +
 * yeniden bildirim aralığı. Koşul tanımları `catalog.ts`'te; bu dosya
 * yalnız tipleri ve sabitleri taşır (katalog buradan import eder — döngü yok).
 */

import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';

export const RULE_SCOPES = ['all', 'product', 'vendor'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];
export const SCOPE_LABELS: Record<RuleScope, string> = { all: 'Tüm ürünler', product: 'Ürün', vendor: 'Tedarikçi' };

export const RULE_DOMAINS = ['stok', 'satinalma', 'analiz'] as const;
export type RuleDomain = (typeof RULE_DOMAINS)[number];
export const DOMAIN_LABELS: Record<RuleDomain, string> = { stok: 'Stok Takibi', satinalma: 'Satın Alma', analiz: 'Analiz' };

export const RULE_CHANNELS = ['notification', 'email'] as const;
export type RuleChannel = (typeof RULE_CHANNELS)[number];
export const CHANNEL_LABELS: Record<RuleChannel, string> = { notification: 'Bildirim', email: 'E-posta' };

export const RULE_LOGICS = ['and', 'or'] as const;
export type RuleLogic = (typeof RULE_LOGICS)[number];
export const LOGIC_LABELS: Record<RuleLogic, string> = { and: 'VE · hepsi', or: 'VEYA · herhangi biri' };

export const RULE_WINDOWS = [24, 48, 168, 720, 2160] as const;
export type RuleWindowHours = (typeof RULE_WINDOWS)[number];
export const WINDOW_LABELS: Record<RuleWindowHours, string> = {
  24: '24 saat',
  48: '48 saat',
  168: '7 gün',
  720: '30 gün',
  2160: '90 gün',
};

export const THRESHOLD_UNITS = ['units', 'percent', 'days'] as const;
export type ThresholdUnit = (typeof THRESHOLD_UNITS)[number];

/** Bir kuralda en fazla bu kadar koşul (form + şema + motor aynı sınırı okur). */
export const MAX_CONDITIONS = 5;

export const RULE_METRICS = [
  // stok
  'stock_drop',
  'stock_below',
  'days_of_cover_below',
  'sales_above',
  'no_sales',
  // satın alma
  'reorder_point_reached',
  'below_safety_stock',
  'suggested_qty_above',
  // analiz
  'stockout_before_lead_time',
  'sell_through_band_is',
  'aging_bucket_is',
  'abc_class_is',
  'action_is',
] as const;
export type RuleMetric = (typeof RULE_METRICS)[number];

/** Koşul — metriğe göre ayrışan gövde (discriminated union). */
export type RuleCondition =
  | { metric: 'stock_drop'; threshold: number; thresholdUnit: 'units' | 'percent'; windowHours: RuleWindowHours }
  | { metric: 'stock_below'; threshold: number }
  | { metric: 'days_of_cover_below'; threshold: number }
  | { metric: 'sales_above'; threshold: number; windowHours: RuleWindowHours }
  | { metric: 'no_sales'; windowHours: RuleWindowHours }
  | { metric: 'reorder_point_reached' }
  | { metric: 'below_safety_stock' }
  | { metric: 'suggested_qty_above'; threshold: number }
  | { metric: 'stockout_before_lead_time' }
  | { metric: 'sell_through_band_is'; value: SellThroughBand }
  | { metric: 'aging_bucket_is'; value: AgingBucketKey }
  | { metric: 'abc_class_is'; value: AbcClass }
  | { metric: 'action_is'; value: ActionKey };

export type ConditionOf<M extends RuleMetric> = Extract<RuleCondition, { metric: M }>;

/** Motorun ve açıklamanın ihtiyaç duyduğu kural alt kümesi (DB satırı veya form taslağı). */
export interface TrackingRuleLike {
  id: string;
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  domain: RuleDomain;
  channel: RuleChannel;
  logic: RuleLogic;
  /** Aynı ürün + kural için yeniden bildirim aralığı; dedupe kovası da bu. */
  cooldownHours: RuleWindowHours;
  conditions: RuleCondition[];
}

/** Motorun bir ürün için gördüğü tek veri yüzeyi (DB'den toplanır, koşullar buradan okur). */
export interface RuleTarget {
  productId: string;
  productName: string;
  vendorId: string | null;
  currentStock: number;
  /** stock_drop için pencere kadar önceki stok; izleme yoksa null (`stockAtWindow` haritası). */
  previousStockByWindow: ReadonlyMap<RuleWindowHours, number | null>;
  /** Gün anahtarı → satış adedi (son 90 gün). */
  soldByDate: ReadonlyMap<string, number>;
  /** Son 30 gün satış adedi (hız). */
  soldQty30: number;
  /** Son 30 günün günlük satışları, eskiden yeniye, satışsız gün 0. */
  dailyQuantities: number[];
  /** Mağaza geneli ABC sınıfı; yalnız gerektiğinde hesaplanır. */
  abcClass: AbcClass | null;
  leadTimeDays: number;
  targetStockDays: number;
  /** Bugünün gün anahtarı (merchant TZ) — pencere hesapları için. */
  todayKey: string;
}

export function isRuleScope(v: unknown): v is RuleScope {
  return typeof v === 'string' && (RULE_SCOPES as readonly string[]).includes(v);
}
export function isRuleDomain(v: unknown): v is RuleDomain {
  return typeof v === 'string' && (RULE_DOMAINS as readonly string[]).includes(v);
}
export function isRuleChannel(v: unknown): v is RuleChannel {
  return typeof v === 'string' && (RULE_CHANNELS as readonly string[]).includes(v);
}
export function isRuleLogic(v: unknown): v is RuleLogic {
  return typeof v === 'string' && (RULE_LOGICS as readonly string[]).includes(v);
}
export function isRuleMetric(v: unknown): v is RuleMetric {
  return typeof v === 'string' && (RULE_METRICS as readonly string[]).includes(v);
}
export function isRuleWindow(v: unknown): v is RuleWindowHours {
  return typeof v === 'number' && (RULE_WINDOWS as readonly number[]).includes(v);
}
