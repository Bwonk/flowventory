import { percentDelta } from '@/lib/reports/trend';
import type { ActiveDigestFrequency, DateKeyRange, DigestRanges } from './schedule';

/**
 * Özet raporu içeriği — saf fonksiyon (test edilebilir).
 *
 * Stok tanımları dashboard'la aynıdır (`app/dashboard/lib/metrics.ts`), ki
 * e-postadaki sayı uygulamada görülenle tutsun:
 * - Tükenen: en az bir varyantı 0 stoklu ürün
 * - Az kalan: tükenmemiş, bir varyantı 1..warningThreshold arası ürün
 * - Ölü stok: stok var, son 30 günde satış yok ya da stok ömrü 180+ gün
 * - Bağlı sermaye: stok × alış fiyatı (yoksa satış fiyatı → tahmini)
 */

export const DIGEST_TOP_PRODUCTS = 5;
export const DIGEST_LOW_STOCK_ITEMS = 5;
/** Ölü stok penceresi — dashboard'daki 30 günlük satış verisiyle aynı. */
export const DEAD_STOCK_WINDOW_DAYS = 30;
const DEAD_STOCK_MAX_DAYS = 180;

export interface DigestSnapshotRow {
  productId: string;
  productName: string;
  variantId: string;
  totalStock: number;
  sellPrice: number;
  buyPrice: number | null;
}

export interface DigestSalesRow {
  variantId: string;
  date: string;
  quantity: number;
  revenue: number;
}

export interface DigestPurchaseSummary {
  lineCount: number;
  urgentCount: number;
  totalCost: number;
  hasEstimate: boolean;
}

export interface DigestInput {
  frequency: ActiveDigestFrequency;
  ranges: DigestRanges;
  /** Ölü stok için son 30 günün aralığı (bugün dahil). */
  deadStockWindow: DateKeyRange;
  warningThreshold: number;
  snapshots: DigestSnapshotRow[];
  /** En az `previous.start` ile `deadStockWindow.end` arasını kapsayan satış satırları. */
  sales: DigestSalesRow[];
  purchase: DigestPurchaseSummary;
}

export interface DigestContent {
  frequency: ActiveDigestFrequency;
  ranges: DigestRanges;
  sales: {
    revenue: number;
    previousRevenue: number;
    /** Yüzde değişim (tam sayı); önceki dönem boşsa null. */
    revenueDelta: number | null;
    units: number;
    previousUnits: number;
    unitsDelta: number | null;
  };
  topProducts: Array<{ productId: string; productName: string; revenue: number; units: number }>;
  stock: {
    productCount: number;
    outOfStockCount: number;
    lowStockCount: number;
    warningThreshold: number;
    /** En düşük stoklu ürünler (tükenenler önce). */
    lowest: Array<{ productId: string; productName: string; minStock: number }>;
  };
  deadStock: { count: number; lockedCapital: number; isEstimate: boolean };
  purchase: DigestPurchaseSummary;
}

const inRange = (date: string, range: DateKeyRange) => date >= range.start && date <= range.end;
const round2 = (n: number) => Math.round(n * 100) / 100;

interface ProductAgg {
  productId: string;
  productName: string;
  variants: DigestSnapshotRow[];
  minStock: number;
  totalStock: number;
}

export function computeDigest(input: DigestInput): DigestContent {
  const { ranges, deadStockWindow, warningThreshold } = input;

  const products = new Map<string, ProductAgg>();
  const variantToProduct = new Map<string, string>();
  for (const snap of input.snapshots) {
    variantToProduct.set(snap.variantId, snap.productId);
    const p = products.get(snap.productId) ?? {
      productId: snap.productId,
      productName: snap.productName,
      variants: [],
      minStock: Number.POSITIVE_INFINITY,
      totalStock: 0,
    };
    p.variants.push(snap);
    p.minStock = Math.min(p.minStock, snap.totalStock);
    p.totalStock += snap.totalStock;
    products.set(snap.productId, p);
  }

  // Satış: dönem toplamları + ürün bazlı dönem cirosu + 30 günlük adet.
  let revenue = 0;
  let units = 0;
  let previousRevenue = 0;
  let previousUnits = 0;
  const periodByProduct = new Map<string, { revenue: number; units: number }>();
  const windowQtyByProduct = new Map<string, number>();
  for (const row of input.sales) {
    const productId = variantToProduct.get(row.variantId);
    if (inRange(row.date, ranges.current)) {
      revenue += row.revenue;
      units += row.quantity;
      if (productId) {
        const agg = periodByProduct.get(productId) ?? { revenue: 0, units: 0 };
        agg.revenue += row.revenue;
        agg.units += row.quantity;
        periodByProduct.set(productId, agg);
      }
    } else if (inRange(row.date, ranges.previous)) {
      previousRevenue += row.revenue;
      previousUnits += row.quantity;
    }
    if (productId && inRange(row.date, deadStockWindow)) {
      windowQtyByProduct.set(productId, (windowQtyByProduct.get(productId) ?? 0) + row.quantity);
    }
  }

  const topProducts = Array.from(periodByProduct.entries())
    .filter(([, agg]) => agg.revenue > 0)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, DIGEST_TOP_PRODUCTS)
    .map(([productId, agg]) => ({
      productId,
      productName: products.get(productId)?.productName ?? '—',
      revenue: round2(agg.revenue),
      units: agg.units,
    }));

  // Stok durumu + ölü stok
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let deadCount = 0;
  let lockedCapital = 0;
  let lockedIsEstimate = false;
  const lowStock: ProductAgg[] = [];
  for (const p of products.values()) {
    const outOfStock = p.variants.some(v => v.totalStock === 0);
    if (outOfStock) outOfStockCount++;
    else if (p.variants.some(v => v.totalStock > 0 && v.totalStock <= warningThreshold)) lowStockCount++;
    if (p.minStock <= warningThreshold) lowStock.push(p);

    if (p.totalStock === 0) continue;
    const soldQty = windowQtyByProduct.get(p.productId) ?? 0;
    const dead =
      soldQty === 0 || Math.round(p.totalStock / (soldQty / DEAD_STOCK_WINDOW_DAYS)) > DEAD_STOCK_MAX_DAYS;
    if (!dead) continue;
    deadCount++;
    for (const v of p.variants) {
      if (v.totalStock === 0) continue;
      const price = v.buyPrice ?? v.sellPrice;
      if (v.buyPrice == null && price > 0) lockedIsEstimate = true;
      lockedCapital += v.totalStock * price;
    }
  }

  const lowest = lowStock
    .sort((a, b) => a.minStock - b.minStock || a.productName.localeCompare(b.productName, 'tr'))
    .slice(0, DIGEST_LOW_STOCK_ITEMS)
    .map(p => ({ productId: p.productId, productName: p.productName, minStock: p.minStock }));

  return {
    frequency: input.frequency,
    ranges,
    sales: {
      revenue: round2(revenue),
      previousRevenue: round2(previousRevenue),
      revenueDelta: percentDelta(revenue, previousRevenue),
      units,
      previousUnits,
      unitsDelta: percentDelta(units, previousUnits),
    },
    topProducts,
    stock: {
      productCount: products.size,
      outOfStockCount,
      lowStockCount,
      warningThreshold,
      lowest,
    },
    deadStock: { count: deadCount, lockedCapital: round2(lockedCapital), isEstimate: lockedIsEstimate },
    purchase: input.purchase,
  };
}
