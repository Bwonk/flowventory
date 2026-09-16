import { WINDOW_LABELS, type TrackingRuleLike } from './types';

/**
 * Kuralı tek cümleyle anlatır — form önizlemesi, liste satırı ve e-posta
 * aynı metni kullanır: "Tüm ürünler için 24 saat içinde stok 50 adet düşerse".
 */
export function describeRule(rule: Omit<TrackingRuleLike, 'id' | 'name'>): string {
  return `${describeScope(rule)} ${describeCondition(rule)}`;
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

export function describeCondition(
  rule: Pick<TrackingRuleLike, 'metric' | 'threshold' | 'thresholdUnit' | 'windowHours'>,
): string {
  const window = WINDOW_LABELS[rule.windowHours] ?? `${rule.windowHours} saat`;
  const n = rule.threshold.toLocaleString('tr-TR');
  switch (rule.metric) {
    case 'stock_drop':
      return rule.thresholdUnit === 'percent'
        ? `${window} içinde stok %${n} düşerse`
        : `${window} içinde stok ${n} adet düşerse`;
    case 'stock_below':
      return `stok ${n} adedin altına inerse`;
    case 'days_of_cover_below':
      return `stok ömrü ${n} günün altına inerse`;
    case 'sales_above':
      return `${window} içinde satış ${n} adedi geçerse`;
    case 'no_sales':
      return `${window} boyunca satış olmazsa`;
  }
}
