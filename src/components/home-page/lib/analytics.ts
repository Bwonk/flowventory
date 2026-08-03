import type { Product, TopProduct } from '../types';

/** Bu ürüne ait varyantların 30 günlük toplam cirosu. */
export function getProductRevenue(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.revenue, 0);
}

/** Bu ürüne ait varyantların 30 günlük toplam satış adedi. */
export function getProductQuantity(product: Product, topProducts: TopProduct[]): number {
  return topProducts
    .filter(p => product.variants.some(v => v.id === p.variantId))
    .reduce((sum, p) => sum + p.quantity, 0);
}

export function getVariantRevenue(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.revenue ?? 0;
}

export function getVariantQuantity(variantId: string, topProducts: TopProduct[]): number {
  return topProducts.find(p => p.variantId === variantId)?.quantity ?? 0;
}
