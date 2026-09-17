import { describeCondition } from './catalog';
import { CHANNEL_LABELS, type RuleLogic, type RuleWindowHours, type TrackingRuleLike } from './types';

export { describeCondition };

/**
 * Kuralı tek cümleyle anlatır — form önizlemesi, liste satırı ve e-posta
 * aynı metni kullanır: "Tüm ürünler için 24 saat içinde stok 50 adet düşerse
 * ve stok 5 adedin altına inerse".
 */
export function describeRule(rule: Pick<TrackingRuleLike, 'scope' | 'targetLabel' | 'logic' | 'conditions'>): string {
  if (rule.conditions.length === 0) return `${describeScope(rule)} koşul tanımlanmadı`;
  return `${describeScope(rule)} ${joinClauses(rule.conditions.map(describeCondition), rule.logic)}`;
}

export function describeScope(rule: Pick<TrackingRuleLike, 'scope' | 'targetLabel'>): string {
  switch (rule.scope) {
    case 'product':
      return `${rule.targetLabel ?? 'Seçili ürün'} için`;
    case 'vendor':
      return `${rule.targetLabel ?? 'Seçili tedarikçi'} ürünlerinde`;
    default:
      return 'Tüm ürünler için';
  }
}

/** "A", "A ve B", "A, B ve C" / "A ya da B", "A, B ya da C". */
export function joinClauses(clauses: readonly string[], logic: RuleLogic): string {
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return clauses[0];
  const conj = logic === 'and' ? 've' : 'ya da';
  return `${clauses.slice(0, -1).join(', ')} ${conj} ${clauses[clauses.length - 1]}`;
}

/** "24 saatte", "7 günde" — yeniden bildirim aralığı için bulunma hâli. */
const COOLDOWN_LOCATIVE: Record<RuleWindowHours, string> = {
  24: '24 saatte',
  48: '48 saatte',
  168: '7 günde',
  720: '30 günde',
  2160: '90 günde',
};

/** Sonuç kartı / liste: "Bildirim zilde · aynı ürün için en fazla 24 saatte bir". */
export function describeOutcome(rule: Pick<TrackingRuleLike, 'channel' | 'cooldownHours'>): string {
  const where = rule.channel === 'email' ? 'E-posta gönderilir' : 'Bildirim zilde';
  const every = COOLDOWN_LOCATIVE[rule.cooldownHours] ?? `${rule.cooldownHours} saatte`;
  return `${where} · aynı ürün için en fazla ${every} bir`;
}

export const channelLabel = (rule: Pick<TrackingRuleLike, 'channel'>) => CHANNEL_LABELS[rule.channel];
