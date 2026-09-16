import { daysOfCover, velocityPerDay } from '@/lib/stock-history/projection';
import { shiftDateKey } from '@/lib/timezone';
import type { TrackingRuleLike } from './types';

/**
 * Kural değerlendirmesi — saf. DB'den toplanan ürün durumu (`RuleTarget`)
 * ve kural verilir, tetikleniyorsa bildirim adayı döner.
 */

export interface RuleTarget {
  productId: string;
  productName: string;
  vendorId: string | null;
  currentStock: number;
  /** Kuralın penceresi kadar önceki stok; izleme o zaman yoksa null. */
  previousStock: number | null;
  /** Kural penceresindeki satış adedi (gün çözünürlüklü). */
  soldInWindow: number;
  /** Son 30 gün satış adedi — stok ömrü için hız. */
  soldQty30: number;
}

export interface RuleHit {
  ruleId: string;
  productId: string;
  title: string;
  body: string;
  dedupeKey: string;
}

const HOUR_MS = 60 * 60 * 1000;

export function matchesScope(rule: Pick<TrackingRuleLike, 'scope' | 'targetId'>, target: Pick<RuleTarget, 'productId' | 'vendorId'>): boolean {
  switch (rule.scope) {
    case 'product':
      return rule.targetId === target.productId;
    case 'vendor':
      return rule.targetId !== null && rule.targetId === target.vendorId;
    default:
      return true;
  }
}

/**
 * Kayan pencere için dedupe anahtarı: pencere uzunluğunda kovalar.
 * Kova sınırındaki çift tetiklemeyi DB tarafındaki cooldown kontrolü kapatır.
 */
export function buildRuleDedupeKey(ruleId: string, productId: string, now: Date, windowHours: number): string {
  const bucket = Math.floor(now.getTime() / (windowHours * HOUR_MS));
  return `rule:${ruleId}:${productId}:${bucket}`;
}

/** Satış pencereleri gün çözünürlüklü: 24s → bugün, 48s → dün+bugün, 7g → son 7 gün. */
export function windowStartDateKey(todayKey: string, windowHours: number): string {
  const days = Math.max(1, Math.ceil(windowHours / 24));
  return shiftDateKey(todayKey, -(days - 1));
}

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

export function evaluateRule(rule: TrackingRuleLike, target: RuleTarget, now: Date): RuleHit | null {
  if (!matchesScope(rule, target)) return null;
  const body = evaluateCondition(rule, target);
  if (!body) return null;
  return {
    ruleId: rule.id,
    productId: target.productId,
    title: `${target.productName} — ${rule.name}`,
    body,
    dedupeKey: buildRuleDedupeKey(rule.id, target.productId, now, rule.windowHours),
  };
}

/** Koşul sağlanıyorsa bildirim gövdesi, değilse null. */
function evaluateCondition(rule: TrackingRuleLike, t: RuleTarget): string | null {
  const windowDays = Math.max(1, Math.ceil(rule.windowHours / 24));
  const windowText = rule.windowHours < 48 ? `Son ${rule.windowHours} saatte` : `Son ${windowDays} günde`;

  switch (rule.metric) {
    case 'stock_drop': {
      if (t.previousStock === null) return null;
      const drop = t.previousStock - t.currentStock;
      if (drop <= 0) return null;
      const pct = t.previousStock > 0 ? Math.round((drop / t.previousStock) * 100) : null;
      const hit =
        rule.thresholdUnit === 'percent'
          ? pct !== null && pct >= rule.threshold
          : drop >= rule.threshold;
      if (!hit) return null;
      return `${windowText} stok ${fmt(t.previousStock)} → ${fmt(t.currentStock)} (−${fmt(drop)} adet${pct !== null ? `, %${pct}` : ''}).`;
    }
    case 'stock_below': {
      if (t.currentStock >= rule.threshold) return null;
      return `Stok ${fmt(t.currentStock)} adet — eşik ${fmt(rule.threshold)}.`;
    }
    case 'days_of_cover_below': {
      const velocity = velocityPerDay(t.soldQty30);
      const cover = daysOfCover(t.currentStock, velocity);
      if (cover === null || cover >= rule.threshold) return null;
      return `${fmt(t.currentStock)} adet, günde ~${fmt(velocity)} satış → ~${fmt(cover)} gün idare eder (eşik ${fmt(rule.threshold)} gün).`;
    }
    case 'sales_above': {
      if (t.soldInWindow < rule.threshold) return null;
      return `${windowText} ${fmt(t.soldInWindow)} adet satıldı (eşik ${fmt(rule.threshold)}).`;
    }
    case 'no_sales': {
      if (t.soldInWindow > 0 || t.currentStock <= 0) return null;
      return `${windowText} satış yok; ${fmt(t.currentStock)} adet stok bekliyor.`;
    }
  }
}
