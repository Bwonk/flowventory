import type { Product, ProductRow, StatusFilter, StockRange, SortBy, TopProduct } from '../types';
import { STATUS_SEVERITY } from '../constants';
import { getDaysRemaining, getProductCategory, getProductStatus, getProductThumbnail, getTotalStock } from './product';

/** Ürünü tek satıra indirger: en kötü varyant durumu + toplam stok. */
export function flattenToProducts(
  products: Product[],
  criticalThreshold: number,
  warningThreshold: number,
  viewStats?: Record<string, number> | null,
  topProducts?: TopProduct[],
): ProductRow[] {
  return products.map(product => ({
    productId: product.id,
    productName: product.name,
    category: getProductCategory(product),
    thumbnail: getProductThumbnail(product),
    status: getProductStatus(product, criticalThreshold, warningThreshold),
    totalStock: getTotalStock(product),
    variantCount: product.variants.length,
    viewCount: viewStats?.[product.id],
    daysRemaining: getDaysRemaining(product, topProducts ?? []),
  }));
}

export function matchesStockRange(stock: number, range: StockRange): boolean {
  switch (range) {
    case '0':
      return stock === 0;
    case '1-10':
      return stock >= 1 && stock <= 10;
    case '11-50':
      return stock >= 11 && stock <= 50;
    case '51-100':
      return stock >= 51 && stock <= 100;
    case '100+':
      return stock > 100;
    default:
      return true;
  }
}

export function sortRows(rows: ProductRow[], sortBy: SortBy): ProductRow[] {
  const copy = [...rows];
  switch (sortBy) {
    case 'stok-omru':
      return copy.sort((a, b) => {
        const aVal = a.daysRemaining ?? Infinity;
        const bVal = b.daysRemaining ?? Infinity;
        return aVal - bVal;
      });
    case 'stok-azalan':
      return copy.sort((a, b) => b.totalStock - a.totalStock);
    case 'stok-artan':
      return copy.sort((a, b) => a.totalStock - b.totalStock);
    case 'isim-az':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
    case 'aciliyet':
    default:
      // En acil (kritik) önce; eşitse en düşük toplam stok üstte.
      return copy.sort(
        (a, b) => STATUS_SEVERITY[a.status] - STATUS_SEVERITY[b.status] || a.totalStock - b.totalStock,
      );
  }
}

export function filterRows(
  rows: ProductRow[],
  statusFilter: StatusFilter,
  query: string,
  stockRange: StockRange,
  sortBy: SortBy,
): ProductRow[] {
  const q = query.toLowerCase().trim();
  let filtered = rows;

  // Birincil filtre: en kötü varyant durumuna göre.
  if (statusFilter === 'tukendi') filtered = filtered.filter(r => r.status === 'critical');
  else if (statusFilter === 'az-kalan') filtered = filtered.filter(r => r.status === 'warning');
  else if (statusFilter === 'saglikli') filtered = filtered.filter(r => r.status === 'healthy');

  // İkincil filtre: toplam stok aralığı.
  if (stockRange !== 'all') {
    filtered = filtered.filter(r => matchesStockRange(r.totalStock, stockRange));
  }

  // Arama filtresi (ürün adı).
  if (q) {
    filtered = filtered.filter(r => r.productName.toLowerCase().includes(q));
  }

  // Sıralama.
  return sortRows(filtered, sortBy);
}
