import { ORDER_ROUNDING_MULTIPLE } from '@/lib/reports/purchase';
import type {
  PurchaseReportApiResponse,
  PurchaseReportLine,
  PurchaseReportVendor,
} from '@/app/api/reports/purchase/route';

/**
 * Sepet: variantId → sipariş adedi. Varlık = satır tikli; değer = adet.
 * Geçicidir — Yenile/refetch'te güncel önerilerle yeniden tohumlanır
 * (stockOverrides ile aynı yaşam döngüsü).
 */
export type BasketState = Record<string, number>;

/** Sunucunun quick-stock sınırıyla aynı üst limit. */
export const MAX_ORDER_QTY = 100_000;

export function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), MAX_ORDER_QTY);
}

/** Tikleme anındaki varsayılan adet: öneri varsa öneri, yoksa 5 (sipariş katı). */
export function defaultQtyFor(line: PurchaseReportLine): number {
  return line.needsOrder ? line.suggestedQty : ORDER_ROUNDING_MULTIPLE;
}

/** Açılış sepeti: tüm öneri satırları önerilen adetle seçili (e-posta davranışıyla birebir). */
export function seedBasket(report: PurchaseReportApiResponse): BasketState {
  const basket: BasketState = {};
  for (const vendor of report.vendors) {
    for (const line of vendor.lines) {
      if (line.needsOrder) basket[line.variantId] = line.suggestedQty;
    }
  }
  return basket;
}

export interface BasketLine {
  line: PurchaseReportLine;
  qty: number;
}

/** Tedarikçinin sepetteki satırları, rapor sırasıyla. */
export function vendorBasketLines(vendor: PurchaseReportVendor, basket: BasketState): BasketLine[] {
  return vendor.lines
    .filter(line => line.variantId in basket)
    .map(line => ({ line, qty: basket[line.variantId] }));
}

export interface BasketTotals {
  count: number;
  total: number;
  hasEstimate: boolean;
}

export function vendorBasketTotals(vendor: PurchaseReportVendor, basket: BasketState): BasketTotals {
  return vendorBasketLines(vendor, basket).reduce<BasketTotals>(
    (acc, { line, qty }) => ({
      count: acc.count + 1,
      total: acc.total + qty * line.unitCost,
      hasEstimate: acc.hasEstimate || line.isEstimate,
    }),
    { count: 0, total: 0, hasEstimate: false },
  );
}

/** Tüm tedarikçiler üzerinden rozet sayısı + çekmece genel toplamı. */
export function basketTotals(vendors: PurchaseReportVendor[], basket: BasketState): BasketTotals {
  return vendors.reduce<BasketTotals>(
    (acc, vendor) => {
      const t = vendorBasketTotals(vendor, basket);
      return {
        count: acc.count + t.count,
        total: acc.total + t.total,
        hasEstimate: acc.hasEstimate || t.hasEstimate,
      };
    },
    { count: 0, total: 0, hasEstimate: false },
  );
}
