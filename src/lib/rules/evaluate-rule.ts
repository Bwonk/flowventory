import { evaluateCondition, windowStartDateKey } from './catalog';
import type { RuleTarget, TrackingRuleLike } from './types';

/**
 * Kural değerlendirmesi — saf. DB'den toplanan ürün durumu (`RuleTarget`)
 * ve kural verilir; koşullar tek bağlaçla (VE/VEYA) birleştirilir,
 * tetikleniyorsa bildirim adayı döner.
 */

export type { RuleTarget };
export { windowStartDateKey };

export interface RuleHit {
  ruleId: string;
  productId: string;
  productName: string;
  title: string;
  body: string;
  dedupeKey: string;
}

const HOUR_MS = 60 * 60 * 1000;

export function matchesScope(
  rule: Pick<TrackingRuleLike, 'scope' | 'targetId'>,
  target: Pick<RuleTarget, 'productId' | 'vendorId'>,
): boolean {
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
 * Kayan pencere için dedupe anahtarı: yeniden bildirim aralığı uzunluğunda
 * kovalar. Kova sınırındaki çift tetiklemeyi DB tarafındaki cooldown kapatır.
 */
export function buildRuleDedupeKey(ruleId: string, productId: string, now: Date, cooldownHours: number): string {
  const bucket = Math.floor(now.getTime() / (cooldownHours * HOUR_MS));
  return `rule:${ruleId}:${productId}:${bucket}`;
}

export function evaluateRule(rule: TrackingRuleLike, target: RuleTarget, now: Date): RuleHit | null {
  if (!matchesScope(rule, target)) return null;
  if (rule.conditions.length === 0) return null;

  const bodies = rule.conditions.map(c => evaluateCondition(c, target));
  const satisfied = bodies.filter((b): b is string => b !== null);
  const pass = rule.logic === 'and' ? satisfied.length === bodies.length : satisfied.length > 0;
  if (!pass) return null;

  return {
    ruleId: rule.id,
    productId: target.productId,
    productName: target.productName,
    title: `${target.productName} — ${rule.name}`,
    body: satisfied.join(' '),
    dedupeKey: buildRuleDedupeKey(rule.id, target.productId, now, rule.cooldownHours),
  };
}
