/** Stok geçmişi kaydının kaynağı: ilk görüldüğünde baseline, sonra sync/refresh. */
export type StockHistorySource = 'baseline' | 'sync' | 'refresh';

/** Yazılacak bir geçmiş satırı (merchantId ve recordedAt çağıran tarafça eklenir). */
export interface StockHistoryEntry {
  productId: string;
  variantId: string;
  totalStock: number;
  source: StockHistorySource;
}

/** Snapshot'ın diff için gereken alt kümesi. */
export interface StockRow {
  productId: string;
  variantId: string;
  totalStock: number;
}

/** Okuma tarafı: bir varyantın belirli andaki stoğu. */
export interface StockRecord {
  variantId: string;
  totalStock: number;
  recordedAt: Date;
}
