/**
 * Dönem karşılaştırma yardımcıları — "son 30 gün vs önceki 30 gün".
 */

/**
 * Yüzde değişim, tam sayıya yuvarlanır (TrendBadge tam sayı bekler).
 * Önceki dönem 0 ya da negatifse anlamlı oran yoktur → null.
 */
export function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
