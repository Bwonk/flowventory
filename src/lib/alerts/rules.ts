/**
 * Alarm kuralları — saf fonksiyonlar (test edilebilir).
 *
 * Üç kural:
 * - critical-stock: ürünün en az bir varyantı tükendi veya kritik eşiğin altında
 * - dead-stock:     stok var ama pencerede hiç satış yok (haftalık dedupe)
 * - sales-spike:    bugünkü satış, önceki 7 gün ortalamasının 3 katından fazla
 */

export type AlertType = 'critical-stock' | 'dead-stock' | 'sales-spike';

export interface AlertCandidate {
  type: AlertType;
  productId: string;
  title: string;
  body: string;
  /** Aynı olayın aynı periyotta tekrar bildirilmesini engeller. */
  dedupeKey: string;
}

export const SPIKE_MULTIPLIER = 3;
export const SPIKE_MIN_UNITS = 5;

export interface ProductStockState {
  productId: string;
  productName: string;
  /** Ürünün varyantları arasındaki minimum stok. */
  minStock: number;
  totalStock: number;
  /** Penceredeki toplam satış adedi. */
  soldQtyWindow: number;
}

export function evaluateCriticalStock(
  product: ProductStockState,
  criticalThreshold: number,
  dayKey: string,
): AlertCandidate | null {
  if (product.minStock > criticalThreshold) return null;
  const outOfStock = product.minStock === 0;
  // Başlık ürün adıyla başlar: panelde art arda gelen bildirimler aynı jenerik
  // başlığı tekrarlamasın, ayırt edici bilgi ilk bakışta okunsun.
  return {
    type: 'critical-stock',
    productId: product.productId,
    title: outOfStock
      ? `${product.productName} stoğu tükendi`
      : `${product.productName} kritik stok seviyesinde`,
    body: outOfStock
      ? 'En az bir varyantı tükendi.'
      : `Stok, kritik eşiğin (${criticalThreshold}) altına düştü.`,
    dedupeKey: `critical-stock:${product.productId}:${dayKey}`,
  };
}

export function evaluateDeadStock(
  product: ProductStockState,
  weekKey: string,
): AlertCandidate | null {
  if (product.totalStock === 0 || product.soldQtyWindow > 0) return null;
  return {
    type: 'dead-stock',
    productId: product.productId,
    title: `${product.productName} 30 gündür satılmadı`,
    body: `${product.totalStock} adet stokta bekliyor.`,
    dedupeKey: `dead-stock:${product.productId}:${weekKey}`,
  };
}

export function evaluateSalesSpike(
  product: { productId: string; productName: string },
  todayQty: number,
  previous7DayQtys: number[],
  dayKey: string,
): AlertCandidate | null {
  if (todayQty < SPIKE_MIN_UNITS) return null;
  const avg =
    previous7DayQtys.length > 0
      ? previous7DayQtys.reduce((a, b) => a + b, 0) / previous7DayQtys.length
      : 0;
  // Geçmişi olmayan üründe ilk satış patlaması da bildirilmeli (avg=0).
  if (avg > 0 && todayQty <= avg * SPIKE_MULTIPLIER) return null;
  return {
    type: 'sales-spike',
    productId: product.productId,
    title: `${product.productName} satışında artış`,
    body:
      avg > 0
        ? `Bugün ${todayQty} adet satıldı — son 7 gün ortalamasının (${avg.toFixed(1)}) ${SPIKE_MULTIPLIER} katından fazla.`
        : `Bugün ${todayQty} adet satıldı.`,
    dedupeKey: `sales-spike:${product.productId}:${dayKey}`,
  };
}
