import type { Product, Variant, ProductStatus, VariantSales } from '../types';

export function getProductStatus(
  product: Product,
  criticalThreshold = 5,
  warningThreshold = 10,
): 'critical' | 'warning' | 'healthy' {
  let hasWarning = false;
  for (const variant of product.variants) {
    const stock = getVariantStock(variant);
    if (stock <= criticalThreshold) return 'critical';
    if (stock <= warningThreshold) hasWarning = true;
  }
  return hasWarning ? 'warning' : 'healthy';
}

/** Ürünün ilk kategori adını döndürür; kategori yoksa undefined. */
export function getProductCategory(product: Product): string | undefined {
  return product.categories?.find(c => !!c.name)?.name ?? undefined;
}

/** Ürünün gösterilecek ana görseli: ilk görseli olan varyant. */
export function getProductThumbnail(product: Product): string | undefined {
  return product.variants.find(v => v.imageUrl)?.imageUrl ?? undefined;
}

/** Bir varyantın okunabilir adı (variantValues → SKU → fallback). */
export function getVariantName(variant: Variant): string {
  if (variant.variantValues && variant.variantValues.length > 0) {
    return variant.variantValues.map(v => v.variantValueName).join(' / ');
  }
  return variant.sku || 'Varsayılan';
}

/**
 * Varyantın tüm depolardaki toplam stoğu (B16).
 *
 * Önceden yalnızca `stocks[0]` okunuyordu; sync katmanı ise (ikas-sync.ts)
 * tüm depoları topluyordu. Çok depolu mağazalarda dashboard KPI'ları ile
 * snapshot/analiz farklı sayı gösteriyordu — tek davranışta birleştirildi.
 * Depo bazlı görünüm/transfer önerisi ayrı bir özellik (Katman 3).
 */
export function getVariantStock(variant: Variant): number {
  return (variant.stocks ?? []).reduce((sum, s) => sum + (s?.stockCount ?? 0), 0);
}

export interface VariantStockLocation {
  stockLocationId: string;
  stockCount: number;
}

/** Varyantın depo bazlı stok dağılımı — stok düzenleme hangi depoya yazacağını bilmeli. */
export function getVariantStockLocations(variant: Variant): VariantStockLocation[] {
  return (variant.stocks ?? [])
    .filter((s): s is NonNullable<typeof s> & { stockLocationId: string } => Boolean(s?.stockLocationId))
    .map(s => ({ stockLocationId: s.stockLocationId, stockCount: s.stockCount ?? 0 }));
}

/** Ürünün toplam stok adedi (tüm varyantların toplamı). */
export function getTotalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + getVariantStock(v), 0);
}

/** Tek bir stok değerinden durum türetir. */
export function stockToStatus(
  stock: number,
  criticalThreshold: number,
  warningThreshold: number,
): ProductStatus {
  if (stock <= criticalThreshold) return 'critical';
  if (stock <= warningThreshold) return 'warning';
  return 'healthy';
}

/** Satış hızına göre stoğun kaç gün yeteceğini hesaplar. */
export function getDaysRemaining(product: Product, salesByVariant: VariantSales[]): number | null {
  const totalStock = getTotalStock(product);
  if (totalStock === 0) return 0;

  const soldQuantity = salesByVariant
    .filter(tp => product.variants.some(v => v.id === tp.variantId))
    .reduce((sum, tp) => sum + tp.quantity, 0);

  if (soldQuantity === 0) return null;

  const dailyRate = soldQuantity / 30;
  return Math.round(totalStock / dailyRate);
}
