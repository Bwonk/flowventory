import { getIkas } from '@/helpers/api-helpers';
import { logger } from '@/lib/logger';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import type { AuthToken } from '@/models/auth-token';

/** Pozitif: teslim alınan adet eklenir; negatif: geri al (0'ın altına inmez). */
export type StockDelta = { productId: string; variantId: string; delta: number };

export type StockWrite = {
  productId: string;
  variantId: string;
  delta: number;
  stockLocationId: string;
  previousCount: number;
  newCount: number;
};

export type StockWriteResult = { ok: true; writes: StockWrite[] } | { ok: false; error: string };

const MAX_STOCK = 1_000_000;
const PAGE_LIMIT = 50;

/**
 * Varyant stoklarına fark yazar — hedef her varyantın ilk deposu
 * (stok düzenleyiciyle aynı "DEPO 1" kuralı). ikas yalnız mutlak stok kabul ettiği için canlı
 * değer okunup hemen tek `saveVariantStocks` çağrısıyla yazılır; ara adım yok.
 */
export async function applyStockDeltas(
  merchantId: string,
  authToken: AuthToken,
  deltas: StockDelta[],
): Promise<StockWriteResult> {
  const nonZero = deltas.filter(d => d.delta !== 0);
  if (nonZero.length === 0) return { ok: true, writes: [] };

  const ikasClient = getIkas(authToken);
  const productIds = Array.from(new Set(nonZero.map(d => d.productId)));
  const variants = new Map<string, { stocks?: Array<{ stockLocationId: string; stockCount?: number | null }> }>();
  for (let i = 0; i < productIds.length; i += PAGE_LIMIT) {
    const ids = productIds.slice(i, i + PAGE_LIMIT);
    const res = await ikasClient.queries.listProduct({ id: { in: ids }, pagination: { page: 1, limit: PAGE_LIMIT } });
    if (!res.isSuccess) return { ok: false, error: 'Canlı stok okunamadı' };
    for (const product of res.data?.listProduct?.data ?? []) {
      for (const variant of product.variants) variants.set(variant.id, variant);
    }
  }

  const writes: StockWrite[] = [];
  for (const d of nonZero) {
    const location = (variants.get(d.variantId)?.stocks ?? []).find(s => s?.stockLocationId);
    if (!location) return { ok: false, error: 'Varyant ya da stok deposu bulunamadı' };
    const previousCount = location.stockCount ?? 0;
    const newCount = d.delta > 0 ? previousCount + d.delta : Math.max(0, previousCount + d.delta);
    if (newCount > MAX_STOCK) return { ok: false, error: 'Stok üst sınırı aşılıyor' };
    writes.push({ ...d, stockLocationId: location.stockLocationId, previousCount, newCount });
  }

  const response = await ikasClient.mutations.saveVariantStocks({
    input: {
      stockInputs: writes.map(w => ({
        productId: w.productId,
        variantId: w.variantId,
        stockLocationId: w.stockLocationId,
        stockCount: w.newCount,
      })),
    },
  });
  const errors = response.data?.saveVariantStocks?.errors;
  if (!response.isSuccess || !response.data?.saveVariantStocks || (errors && errors.length > 0)) {
    logger.error('Purchase order stock write rejected', { merchantId, errors });
    return { ok: false, error: 'ikas stok yazımını reddetti' };
  }

  // Yerel snapshot'ı tazele — rapor ve dashboard yeni stoğu görsün.
  await Promise.all(
    productIds.map(productId =>
      refreshProductSnapshot(merchantId, authToken, productId).catch(error => {
        logger.warn('Snapshot refresh after purchase order stock write failed', { productId, error });
      }),
    ),
  );
  return { ok: true, writes };
}
