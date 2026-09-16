import type { StockHistoryEntry, StockHistorySource, StockRow } from './types';

/**
 * Eski snapshot ile yeni satırları karşılaştırıp yalnız değişenleri döner.
 *
 * - Eski snapshot'ta olmayan varyant → `baseline` (ilk gözlem).
 * - Stok farklıysa → verilen `source`.
 * - Aynıysa → kayıt yok (tablo şişmesin).
 * - Yeni listede olmayan (silinen) varyant için kayıt üretilmez.
 */
export function diffStockRows(
  previous: ReadonlyMap<string, StockRow>,
  next: readonly StockRow[],
  source: Exclude<StockHistorySource, 'baseline'>,
): StockHistoryEntry[] {
  const entries: StockHistoryEntry[] = [];
  for (const row of next) {
    const prev = previous.get(row.variantId);
    if (!prev) {
      entries.push({ productId: row.productId, variantId: row.variantId, totalStock: row.totalStock, source: 'baseline' });
    } else if (prev.totalStock !== row.totalStock) {
      entries.push({ productId: row.productId, variantId: row.variantId, totalStock: row.totalStock, source });
    }
  }
  return entries;
}

/** Snapshot satırlarını variantId → satır haritasına çevirir. */
export function indexStockRows(rows: readonly StockRow[]): Map<string, StockRow> {
  const map = new Map<string, StockRow>();
  for (const row of rows) map.set(row.variantId, row);
  return map;
}
