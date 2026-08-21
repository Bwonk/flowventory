import type { AbcClass, AgingBucketKey } from '@/lib/reports/abc';

/**
 * Aksiyon kuralları — analiz sayfasındaki "Bugün ne yapmalı?" kuyrukları.
 *
 * Saf fonksiyonlar: hem panel özetleri hem tablo filtresi aynı deriveAction
 * çıktısını kullanır (tek doğruluk kaynağı). Kurallar her zaman ciro bazlı
 * ABC üzerinden çalışır — kâr toggle'ı görünümü değiştirir, aksiyonu değil;
 * aksi halde toggle'a basınca "yapılacaklar" listesi değişir ve güven sarsılır.
 */

export type ActionKey = 'siparis-ver' | 'eritme-adayi' | 'fazla-stok';

export const ACTION_ORDER: ActionKey[] = ['siparis-ver', 'eritme-adayi', 'fazla-stok'];

/** Fazla stok eşiği: hedef stok gününün katı. Varsayılan ayarlarla 3 × 30 = 90 gün. */
export const OVERSTOCK_MULTIPLIER = 3;

export interface ActionInput {
  abcClass: AbcClass;
  totalStock: number;
  soldQty: number;
  daysOfStock: number | null;
  agingBucket: AgingBucketKey;
  stockoutBeforeLeadTime: boolean;
}

export interface ActionThresholds {
  targetStockDays: number;
}

/**
 * Öncelik sıralı TEK aksiyon döndürür (kuyruklar ayrık kalsın diye);
 * hiçbir kural eşleşmezse null.
 *
 * 1. siparis-ver — A/B sınıfı ürün tedarik süresi dolmadan tükeniyor (stok 0
 *    dahil). C sınıfı tükenmeler bilerek hariç: ABC'nin amacı tam da bu.
 * 2. eritme-adayi — C sınıfı + 180+ gün stok ömrü ya da hiç satışsız → ölü sermaye.
 * 3. fazla-stok — satışı süren ama hedefin OVERSTOCK_MULTIPLIER katından uzun
 *    yetecek stok tutan ürün (1-2'ye düşmemişse).
 */
export function deriveAction(item: ActionInput, thresholds: ActionThresholds): ActionKey | null {
  if ((item.abcClass === 'A' || item.abcClass === 'B') && item.stockoutBeforeLeadTime) {
    return 'siparis-ver';
  }
  if (
    item.abcClass === 'C' &&
    item.totalStock > 0 &&
    (item.agingBucket === '180+' || item.agingBucket === 'satışsız')
  ) {
    return 'eritme-adayi';
  }
  if (
    item.totalStock > 0 &&
    item.soldQty > 0 &&
    item.daysOfStock !== null &&
    item.daysOfStock > thresholds.targetStockDays * OVERSTOCK_MULTIPLIER
  ) {
    return 'fazla-stok';
  }
  return null;
}

/**
 * Hedefin ötesinde bağlı kalan sermaye:
 * stockValue × (daysOfStock − target) / daysOfStock; hedef altında 0.
 */
export function overstockExcessValue(stockValue: number, daysOfStock: number, targetStockDays: number): number {
  if (daysOfStock <= targetStockDays || daysOfStock <= 0) return 0;
  return stockValue * ((daysOfStock - targetStockDays) / daysOfStock);
}
