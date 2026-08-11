/**
 * ABC analizi + stok yaşlandırma — saf hesap fonksiyonları.
 *
 * ABC (Pareto): ürünler ciroya göre sıralanır, kümülatif ciro payına göre
 * sınıflanır — A: ilk %80, B: sonraki %15 (%80-95), C: kalan %5.
 * Hiç ciro yoksa tüm ürünler C sayılır.
 *
 * Yaşlandırma: mevcut stoğun kaç günlük satışa denk geldiğine göre kovalar.
 * Satışı olmayan stoklu ürünler en riskli kovaya ("satışsız") düşer.
 */

export type AbcClass = 'A' | 'B' | 'C';

export const ABC_A_THRESHOLD = 0.8;
export const ABC_B_THRESHOLD = 0.95;

export interface AbcInput {
  id: string;
  revenue: number;
}

/** id → sınıf eşlemesi döndürür. */
export function classifyAbc(items: AbcInput[]): Map<string, AbcClass> {
  const result = new Map<string, AbcClass>();
  const total = items.reduce((s, i) => s + i.revenue, 0);

  if (total <= 0) {
    for (const item of items) result.set(item.id, 'C');
    return result;
  }

  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  let cumulative = 0;
  sorted.forEach((item, index) => {
    cumulative += item.revenue;
    const share = cumulative / total;
    if (item.revenue <= 0) {
      // Ciro katkısı olmayan ürün, kümülatif pay ne olursa olsun C'dir.
      result.set(item.id, 'C');
    } else if (index === 0 || share <= ABC_A_THRESHOLD) {
      // En yüksek cirolu ürün, payı tek başına %80'i aşsa bile A'dır.
      result.set(item.id, 'A');
    } else if (share <= ABC_B_THRESHOLD) {
      result.set(item.id, 'B');
    } else {
      result.set(item.id, 'C');
    }
  });
  return result;
}

export type AgingBucketKey = '0-30' | '31-60' | '61-90' | '91-180' | '180+' | 'satışsız';

export const AGING_BUCKET_ORDER: AgingBucketKey[] = ['0-30', '31-60', '61-90', '91-180', '180+', 'satışsız'];

/**
 * Stok ömrü (gün) → yaşlandırma kovası.
 * @param daysOfStock stok / günlük satış; satış yoksa null verilmeli.
 */
export function agingBucket(daysOfStock: number | null): AgingBucketKey {
  if (daysOfStock === null) return 'satışsız';
  if (daysOfStock <= 30) return '0-30';
  if (daysOfStock <= 60) return '31-60';
  if (daysOfStock <= 90) return '61-90';
  if (daysOfStock <= 180) return '91-180';
  return '180+';
}
