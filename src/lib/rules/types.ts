/**
 * Kural tabanlı takip — sabitler ve tipler (istemci + sunucu ortak, saf).
 *
 * v3 (17 Eyl 2026): kural = kapsam + aşamalı workflow. Aşama = koşullar
 * (koşul başına VE/VEYA; VE önce bağlanır) → aksiyonlar (bildirim, e-posta,
 * stok yazımı). Koşul tanımları `catalog.ts`'te, aksiyonlar
 * `actions-catalog.ts`'te; bu dosya yalnız tipleri ve sabitleri taşır.
 */

import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';
import type { ActionKey } from '@/lib/reports/actions';
import type { SellThroughBand } from '@/lib/reports/sell-through';

export const RULE_SCOPES = ['all', 'product', 'vendor'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];
export const SCOPE_LABELS: Record<RuleScope, string> = { all: 'Tüm ürünler', product: 'Ürün', vendor: 'Tedarikçi' };

/** Koşul seçicide grup başlığı — kuralın tipi değil. */
export const RULE_DOMAINS = ['stok', 'satinalma', 'analiz'] as const;
export type RuleDomain = (typeof RULE_DOMAINS)[number];
export const DOMAIN_LABELS: Record<RuleDomain, string> = { stok: 'Stok Takibi', satinalma: 'Satın Alma', analiz: 'Analiz' };

/** Koşul bağlacı — düğümün kendinden önceki koşula bağlanışı. */
export const RULE_LOGICS = ['and', 'or'] as const;
export type RuleLogic = (typeof RULE_LOGICS)[number];
export const LOGIC_LABELS: Record<RuleLogic, string> = { and: 'VE', or: 'VEYA' };

/** Değerlendirme birimi: ürün toplamı ya da varyant (stok aksiyonu varyant ister). */
export const RULE_GRANULARITIES = ['product', 'variant'] as const;
export type RuleGranularity = (typeof RULE_GRANULARITIES)[number];
export const GRANULARITY_LABELS: Record<RuleGranularity, string> = { product: 'Ürün', variant: 'Varyant' };

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

/** Sınırlar — form + şema + motor aynı değerleri okur. */
export const MAX_STAGES = 3;
export const MAX_CONDITIONS = 5;
export const MAX_ACTIONS = 4;
/** Stok aksiyonu emniyeti (K5): tek yazımda en fazla bu kadar artış. */
export const MAX_STOCK_STEP = 1_000;
export const MAX_STOCK = 1_000_000;
export const MAX_RUNS_PER_DAY_LIMIT = 10;

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
  // aşama ≥ 2 — önceki aşamanın tetiklendiği andan beri
  'stock_drop_since_stage',
  'sales_since_stage',
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
  | { metric: 'action_is'; value: ActionKey }
  | { metric: 'stock_drop_since_stage'; threshold: number }
  | { metric: 'sales_since_stage'; threshold: number };

export type ConditionOf<M extends RuleMetric> = Extract<RuleCondition, { metric: M }>;

/** Koşul düğümü: `op` kendinden önceki koşula bağlanış; ilk düğümün op'u yok sayılır. */
export interface ConditionNode {
  op: RuleLogic;
  condition: RuleCondition;
}

export const RULE_ACTION_TYPES = ['notify', 'email', 'adjust_stock'] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export const STOCK_ADJUST_MODES = ['increase', 'set'] as const;
export type StockAdjustMode = (typeof STOCK_ADJUST_MODES)[number];

/** Aksiyon — tipe göre ayrışan gövde. `email` kayıtlı bildirim adresine gider. */
export type RuleAction =
  | { type: 'notify' }
  | { type: 'email' }
  | { type: 'adjust_stock'; mode: StockAdjustMode; amount: number };

export type ActionOf<T extends RuleActionType> = Extract<RuleAction, { type: T }>;

export interface RuleStage {
  conditions: ConditionNode[];
  actions: RuleAction[];
}

export interface RuleWorkflow {
  stages: RuleStage[];
}

/** Motorun ve açıklamanın ihtiyaç duyduğu kural alt kümesi (DB satırı veya form taslağı). */
export interface TrackingRuleLike {
  id: string;
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  granularity: RuleGranularity;
  workflow: RuleWorkflow;
  /** Aynı hedef + aşama için yeniden çalışma aralığı; dedupe kovası da bu. */
  cooldownHours: RuleWindowHours;
  /** Aşama ilerlemesi bu süre dolunca başa döner. */
  resetHours: RuleWindowHours;
  /** Hedef başına günlük stok yazımı üst sınırı. */
  maxRunsPerDay: number;
}

/** Bir aksiyonun çalışma sonucu — `TrackingRuleEvent.actionsJson` öğesi. */
export interface RuleActionResult {
  type: RuleActionType;
  ok: boolean;
  detail: string;
  /** Yalnız başarılı stok yazımında: "Geri al" için gereken her şey. */
  stock?: {
    stockLocationId: string;
    previousCount: number;
    newCount: number;
    undoneAt?: string;
  };
}

/** Önceki aşamanın tetiklendiği andan bu yana ölçümler (yalnız aşama ≥ 2). */
export interface StageContext {
  stockAtStage: number;
  soldSinceStage: number;
}

/**
 * Motorun bir hedef (ürün ya da varyant) için gördüğü tek veri yüzeyi
 * (DB'den toplanır, koşullar buradan okur).
 */
export interface RuleTarget {
  productId: string;
  /** Varyant düzeyinde değerlendirmede dolu; ürün düzeyinde null. */
  variantId: string | null;
  /** Görünen ad — varyantta "Ürün · Kırmızı / M". */
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
  /** Aşama ≥ 2 değerlendirilirken motor doldurur. */
  stage?: StageContext;
}

export function isRuleScope(v: unknown): v is RuleScope {
  return typeof v === 'string' && (RULE_SCOPES as readonly string[]).includes(v);
}
export function isRuleDomain(v: unknown): v is RuleDomain {
  return typeof v === 'string' && (RULE_DOMAINS as readonly string[]).includes(v);
}
export function isRuleGranularity(v: unknown): v is RuleGranularity {
  return typeof v === 'string' && (RULE_GRANULARITIES as readonly string[]).includes(v);
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
