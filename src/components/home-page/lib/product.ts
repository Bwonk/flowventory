import type { Product, Variant, ProductStatus, TopProduct } from '../types';
import type { StockStatus } from '@/components/shared/badges/StatusBadge';

export function getProductStatus(
  product: Product,
  criticalThreshold = 5,
  warningThreshold = 10,
): 'critical' | 'warning' | 'healthy' {
  let hasWarning = false;
  for (const variant of product.variants) {
    const stock = variant.stocks?.[0]?.stockCount ?? 0;
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

/** Stok sayısından durum türetir. */
export function getStockStatus(
  stock: number,
  criticalThreshold: number = 0,
  warningThreshold: number = 10,
): StockStatus {
  if (stock <= criticalThreshold) return 'critical';
  if (stock <= warningThreshold) return 'warning';
  return 'healthy';
}

/** Bir varyantın okunabilir adı (variantValues → SKU → fallback). */
export function getVariantName(variant: Variant): string {
  if (variant.variantValues && variant.variantValues.length > 0) {
    return variant.variantValues.map(v => v.variantValueName).join(' / ');
  }
  return variant.sku || 'Varsayılan';
}

export function getVariantStock(variant: Variant): number {
  return variant.stocks?.[0]?.stockCount ?? 0;
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
export function getDaysRemaining(product: Product, topProducts: TopProduct[]): number | null {
  const totalStock = getTotalStock(product);
  if (totalStock === 0) return 0;

  const soldQuantity = topProducts
    .filter(tp => product.variants.some(v => v.id === tp.variantId))
    .reduce((sum, tp) => sum + tp.quantity, 0);

  if (soldQuantity === 0) return null;

  const dailyRate = soldQuantity / 30;
  return Math.round(totalStock / dailyRate);
}

/** Progress bar dolgu rengi (duruma göre). */
export function statusFillColor(status: ProductStatus): string {
  if (status === 'critical') return '#b30000';
  if (status === 'warning') return '#d97706';
  return '#003c33';
}
