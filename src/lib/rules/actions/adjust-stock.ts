import { getIkas } from '@/helpers/api-helpers';
import { logger } from '@/lib/logger';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import type { AuthToken } from '@/models/auth-token';
import { computeNewStock } from '../actions-catalog';
import type { ActionOf, RuleActionResult } from '../types';

export interface AdjustStockContext {
  merchantId: string;
  authToken: AuthToken | null;
  productId: string;
  variantId: string | null;
  /** Bu hedef için son 24 saatte başarılı stok yazımı sayısı. */
  runsToday: number;
  maxRunsPerDay: number;
}

const fail = (detail: string): RuleActionResult => ({ type: 'adjust_stock', ok: false, detail });
const fmt = (n: number) => n.toLocaleString('tr-TR');

/**
 * Stok aksiyonu (K4/K5): varyantın canlı stoğu ikas'tan okunur, hedef
 * varyantın ilk deposudur (`/api/ikas/quick-stock` ile aynı kural).
 * `computeNewStock` toplam stok üzerinden hesaplar, fark ilk depoya yazılır.
 * Emniyet: günlük üst sınır + adım sınırı; sonuç "Geri al" verisini taşır.
 */
export async function adjustStockAction(
  ctx: AdjustStockContext,
  action: ActionOf<'adjust_stock'>,
): Promise<RuleActionResult> {
  if (!ctx.variantId) return fail('Stok aksiyonu varyant düzeyinde çalışır');
  if (!ctx.authToken) return fail('ikas yetkisi bulunamadı (auth token yok)');
  if (ctx.runsToday >= ctx.maxRunsPerDay) return fail(`Günlük üst sınır doldu (${ctx.maxRunsPerDay}/gün)`);

  try {
    const ikasClient = getIkas(ctx.authToken);
    const productRes = await ikasClient.queries.listProduct({
      id: { eq: ctx.productId },
      pagination: { page: 1, limit: 1 },
    });
    if (!productRes.isSuccess) return fail('Canlı stok okunamadı');

    const variant = productRes.data?.listProduct?.data?.[0]?.variants.find(v => v.id === ctx.variantId);
    if (!variant) return fail('Varyant bulunamadı');
    const locations = (variant.stocks ?? []).filter(s => s?.stockLocationId);
    if (locations.length === 0) return fail('Stok deposu bulunamadı');

    const total = locations.reduce((sum, l) => sum + (l.stockCount ?? 0), 0);
    const computed = computeNewStock(action.mode, action.amount, total);
    if (!computed.ok) return fail(computed.reason);

    const target = locations[0];
    const previousCount = target.stockCount ?? 0;
    const newCount = previousCount + (computed.next - Math.max(0, total));

    const response = await ikasClient.mutations.saveVariantStocks({
      input: {
        stockInputs: [
          { productId: ctx.productId, variantId: ctx.variantId, stockLocationId: target.stockLocationId, stockCount: newCount },
        ],
      },
    });
    const errors = response.data?.saveVariantStocks?.errors;
    if (!response.isSuccess || !response.data?.saveVariantStocks || (errors && errors.length > 0)) {
      logger.error('Rule stock write failed', { merchantId: ctx.merchantId, productId: ctx.productId, errors });
      return fail('ikas stok yazımını reddetti');
    }

    await refreshProductSnapshot(ctx.merchantId, ctx.authToken, ctx.productId).catch(error => {
      logger.warn('Snapshot refresh after rule stock write failed', { productId: ctx.productId, error });
    });

    return {
      type: 'adjust_stock',
      ok: true,
      detail: `Stok ${fmt(total)} → ${fmt(computed.next)} adet`,
      stock: { stockLocationId: target.stockLocationId, previousCount, newCount },
    };
  } catch (error) {
    logger.error('Rule stock action error', { merchantId: ctx.merchantId, productId: ctx.productId, error });
    return fail('Stok yazılamadı');
  }
}
