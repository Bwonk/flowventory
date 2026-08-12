import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import {
  getDaysRemaining,
  getProductThumbnail,
  getTotalStock,
  getVariantStock,
} from '@/lib/products/product';
import type { Product, Variant, VariantSales } from '@/lib/products/types';
import type { TrendDataPoint } from '@/components/shared/TrendChart';

/**
 * Dashboard metrik hesapları — saf fonksiyonlar.
 * Daha önce page.tsx içinde 12 ayrı useMemo olarak yaşıyordu (CLAUDE.md
 * "sayfalarda iş mantığı olmasın" kuralının ihlali); buraya taşındı,
 * sayfa yalnızca render'dan sorumlu.
 */

/** Ürünün varyantları arasındaki minimum stok (varyant stoğu = tüm depoların toplamı). */
export function minStock(product: Product): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map(getVariantStock));
}

export interface SkuHealth {
  total: number;
  critical: number;
  warning: number;
  healthy: number;
  segments: { healthy: number; warning: number; critical: number };
}

/** SKU (varyant) bazlı stok sağlığı dağılımı. */
export function computeSkuHealth(products: Product[], maxThreshold: number): SkuHealth {
  let critical = 0;
  let warning = 0;
  let healthy = 0;
  for (const product of products) {
    for (const variant of product.variants) {
      const s = getVariantStock(variant);
      if (s === 0) critical++;
      else if (s <= maxThreshold) warning++;
      else healthy++;
    }
  }
  const total = critical + warning + healthy;
  const denominator = total || 1;
  return {
    total,
    critical,
    warning,
    healthy,
    segments: {
      healthy: (healthy / denominator) * 100,
      warning: (warning / denominator) * 100,
      critical: (critical / denominator) * 100,
    },
  };
}

/** Tükenen (0 stoklu varyantı olan) ürün sayısı. */
export function countCritical(products: Product[]): number {
  return products.filter(p => p.variants.some(v => getVariantStock(v) === 0)).length;
}

/** Tükenmemiş ama eşik altında varyantı olan ürün sayısı. */
export function countWarning(products: Product[], maxThreshold: number): number {
  return products.filter(
    p =>
      !p.variants.some(v => getVariantStock(v) === 0) &&
      p.variants.some(v => {
        const s = getVariantStock(v);
        return s > 0 && s <= maxThreshold;
      }),
  ).length;
}

/** Eşik altındaki tüm ürünler; en kritikten (0 stok) başlayarak sıralı. */
export function computeLowStockProducts(products: Product[], maxThreshold: number): Product[] {
  return products.filter(p => minStock(p) <= maxThreshold).sort((a, b) => minStock(a) - minStock(b));
}

/** Ölü stok: stok var ama hiç satılmamış veya stok ömrü 180+ gün. */
export function computeDeadStock(products: Product[], salesByVariant: VariantSales[]): Product[] {
  return products.filter(p => {
    const total = getTotalStock(p);
    if (total === 0) return false;
    const soldQty = salesByVariant
      .filter(tp => p.variants.some(v => v.id === tp.variantId))
      .reduce((s, tp) => s + tp.quantity, 0);
    if (soldQty === 0) return true;
    return Math.round(total / (soldQty / 30)) > 180;
  });
}

export interface LockedCapital {
  total: number;
  /** buyPrice olmayan üründe sellPrice'a düşüldü mü? */
  isEstimate: boolean;
}

/** Ölü stoğa bağlı sermaye — buyPrice esas, yoksa sellPrice (tahmini). */
export function computeLockedCapital(deadStock: Product[]): LockedCapital {
  let total = 0;
  let usedSellPriceFallback = false;
  for (const p of deadStock) {
    for (const v of p.variants) {
      const stock = getVariantStock(v);
      if (stock === 0) continue;
      const buyPrice = v.prices?.[0]?.buyPrice;
      const price = buyPrice ?? v.prices?.[0]?.sellPrice ?? 0;
      if (buyPrice == null && price > 0) usedSellPriceFallback = true;
      total += stock * price;
    }
  }
  return { total, isEstimate: usedSellPriceFallback };
}

export type VariantIndex = Map<string, { product: Product; variant: Variant }>;

/** Varyant id → ürün/varyant eşlemesi (isim, görsel, varyant değerleri için). */
export function buildVariantIndex(products: Product[]): VariantIndex {
  const map: VariantIndex = new Map();
  for (const product of products) {
    for (const variant of product.variants) {
      map.set(variant.id, { product, variant });
    }
  }
  return map;
}

export interface TopSeller {
  key: string;
  productName: string;
  variantName: string | null;
  imageUrl?: string;
  quantity: number;
  revenue: number;
}

/**
 * En çok satanlar: satışları ürün bazında toplar, en çok satan varyantı seçer,
 * satılan adede (eşitlikte ciroya) göre sıralar ve ilk 10'u döndürür.
 */
export function computeTopSellers(salesByVariant: VariantSales[], variantIndex: VariantIndex): TopSeller[] {
  interface Aggregate {
    productName: string;
    quantity: number;
    revenue: number;
    best: { variantId: string; quantity: number; revenue: number } | null;
  }
  const byProduct = new Map<string, Aggregate>();

  for (const tp of salesByVariant) {
    const entry = variantIndex.get(tp.variantId);
    const productId = entry?.product.id ?? tp.variantId;
    const productName = entry?.product.name ?? tp.sku;
    const agg = byProduct.get(productId) ?? { productName, quantity: 0, revenue: 0, best: null };
    agg.quantity += tp.quantity;
    agg.revenue += tp.revenue;
    if (
      !agg.best ||
      tp.quantity > agg.best.quantity ||
      (tp.quantity === agg.best.quantity && tp.revenue > agg.best.revenue)
    ) {
      agg.best = { variantId: tp.variantId, quantity: tp.quantity, revenue: tp.revenue };
    }
    byProduct.set(productId, agg);
  }

  return Array.from(byProduct.entries())
    .map(([key, agg]) => {
      const bestEntry = agg.best ? variantIndex.get(agg.best.variantId) : undefined;
      const variantName = bestEntry
        ? (bestEntry.variant.variantValues ?? [])
            .map(vv => vv.variantValueName)
            .filter((name): name is string => Boolean(name))
            .join(' · ') || null
        : null;
      const imageUrl =
        bestEntry?.variant.imageUrl ?? (bestEntry ? getProductThumbnail(bestEntry.product) : undefined);
      return {
        key,
        productName: agg.productName,
        variantName,
        imageUrl,
        quantity: agg.quantity,
        revenue: agg.revenue,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10);
}

/** Ortalama stok ömrü (anlamsız uç değerler filtrelenir). */
export function computeAvgDaysRemaining(products: Product[], salesByVariant: VariantSales[]): number | null {
  const validDays = products
    .map(p => getDaysRemaining(p, salesByVariant))
    .filter((d): d is number => d !== null && d > 0 && d < 3650);
  return validDays.length > 0 ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length) : null;
}

/** Yüzde değişimden önceki dönem cirosunu geri hesaplar. */
export function computePreviousRevenue(totalRevenue: number, revenueChange: number): number {
  if (totalRevenue === 0) return 0;
  if (revenueChange === 0) return totalRevenue;
  return Math.round((totalRevenue / (1 + revenueChange / 100)) * 100) / 100;
}

/**
 * Trend chart verisi: günlük ciro + görüntülenme tarihlerinin birleşimi.
 * Adet, günün ciro payına orantılanır (varyant bazlı günlük adet verisi yok).
 */
export function buildDashboardTrendData(
  analytics: AnalyticsApiResponse | null,
  dailyViewMap: Map<string, number>,
): TrendDataPoint[] {
  const dailyRev = analytics?.dailyRevenue ?? [];
  const salesByVariant = analytics?.salesByVariant ?? [];
  const totalQty = salesByVariant.reduce((s, tp) => s + tp.quantity, 0);
  const totalDailyRev = dailyRev.reduce((s, d) => s + d.revenue, 0);

  const allDates = new Set<string>();
  for (const date of dailyViewMap.keys()) allDates.add(date);
  for (const d of dailyRev) allDates.add(d.date);

  const revMap = new Map<string, number>();
  for (const d of dailyRev) revMap.set(d.date, d.revenue);

  return Array.from(allDates)
    .sort()
    .map(date => {
      const revenue = revMap.get(date) ?? 0;
      return {
        date,
        revenue,
        quantity: totalDailyRev > 0 ? Math.round((revenue / totalDailyRev) * totalQty) : 0,
        views: dailyViewMap.get(date) ?? 0,
      };
    });
}

/** Gün sayısını "1,2 yıl / 45 gün" biçiminde gösterime hazırlar. */
export function formatStockAge(days: number): { primary: string; secondary: string } {
  const years = days / 365;
  if (years >= 1) {
    return {
      primary: `${years.toFixed(1).replace('.', ',')} yıl`,
      secondary: `${days.toLocaleString('tr-TR')} gün ortalama`,
    };
  }
  return { primary: `${days} gün`, secondary: `${days} gün ortalama` };
}
