import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import { pickMainImageUrl } from '@/lib/ikas-image';
import { fetchAllPages } from '@/lib/ikas-client/pagination';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz } from '@/lib/timezone';
import type { AuthToken } from '@/models/auth-token';

/**
 * ikas → yerel DB senkronizasyonu.
 *
 * Neden: read-through model (her istekte ikas'a sor) yavaş, rate-limit'e
 * açık ve tarihsel veri tutamıyor. Sync katmanı ikas'tan sayfalı tam
 * çekim yapar, API route'ları öncelikle bu tablolardan okur.
 *
 * - ProductSnapshot: varyant bazlı katalog + stok + fiyat görüntüsü
 * - SalesDaily: varyant × gün satış özeti (merchant TZ gün anahtarıyla)
 * - SyncLog: staleness kontrolü + gözlemlenebilirlik
 */

/** Sipariş sync penceresi — analytics 30 günlük karşılaştırma için 60 gün ister. */
export const ORDER_SYNC_WINDOW_DAYS = 60;

/** Bu süreden eski sync varsa yenilenir. */
export const SYNC_MAX_AGE_MINUTES = 30;

/** Aynı merchant için eşzamanlı çift sync'i önler (tek instance). */
const inFlight = new Map<string, Promise<FullSyncResult>>();

export type FullSyncResult = {
  productCount: number;
  salesDayCount: number;
};

/** Ürün kataloğunu (varyant bazlı) ProductSnapshot'a yazar. */
export async function syncProducts(merchantId: string, authToken: AuthToken): Promise<number> {
  const ikasClient = getIkas(authToken);
  const { items: products, complete } = await fetchAllPages(async pagination => {
    const res = await ikasClient.queries.listProduct({ pagination });
    return res.isSuccess ? res.data?.listProduct : null;
  });

  if (!complete) {
    logger.warn('syncProducts: pagination cap reached, snapshot may be partial', { merchantId });
  }

  const syncedAt = new Date();
  const rows = products.flatMap(product =>
    product.variants.map(variant => ({
      merchantId,
      productId: product.id,
      productName: product.name,
      vendorId: product.vendor?.id ?? null,
      vendorName: product.vendor?.name ?? null,
      brandId: product.brand?.id ?? null,
      brandName: product.brand?.name ?? null,
      categoriesJson: product.categories ? JSON.stringify(product.categories) : null,
      variantId: variant.id,
      sku: variant.sku ?? null,
      imageUrl: pickMainImageUrl(merchantId, variant.images) ?? null,
      variantValuesJson: variant.variantValues ? JSON.stringify(variant.variantValues) : null,
      totalStock: (variant.stocks ?? []).reduce((s, st) => s + (st.stockCount ?? 0), 0),
      sellPrice: variant.prices?.[0]?.sellPrice ?? 0,
      buyPrice: variant.prices?.[0]?.buyPrice ?? null,
      currencyCode: variant.prices?.[0]?.currencyCode ?? null,
      syncedAt,
    })),
  );

  // Tam değiştirme: silinen ürünler snapshot'ta kalmasın.
  await prisma.$transaction([
    prisma.productSnapshot.deleteMany({ where: { merchantId } }),
    prisma.productSnapshot.createMany({ data: rows }),
  ]);

  return rows.length;
}

/** Son N günün siparişlerini varyant × gün olarak SalesDaily'ye yazar. */
export async function syncOrders(merchantId: string, authToken: AuthToken): Promise<number> {
  const { timezone } = await getMerchantSettings(merchantId);
  const ikasClient = getIkas(authToken);

  const since = new Date();
  since.setDate(since.getDate() - ORDER_SYNC_WINDOW_DAYS);

  const { items: orders, complete } = await fetchAllPages(async pagination => {
    const res = await ikasClient.queries.listOrderForAnalytics({
      orderedAt: { gte: since.getTime() },
      pagination,
    });
    return res.isSuccess ? res.data?.listOrder : null;
  });

  if (!complete) {
    logger.warn('syncOrders: pagination cap reached, sales data may be partial', { merchantId });
  }

  // variantId × gün toplamı
  const byKey = new Map<string, { variantId: string; sku: string | null; date: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    if (!order.orderedAt) continue;
    const date = dateKeyInTz(order.orderedAt, timezone);
    for (const item of order.orderLineItems ?? []) {
      const variantId = item.variant?.id;
      if (!variantId) continue;
      const key = `${variantId}|${date}`;
      const entry = byKey.get(key) ?? {
        variantId,
        sku: item.variant?.sku ?? null,
        date,
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += item.quantity || 0;
      entry.revenue += (item.finalPrice || 0) * (item.quantity || 1);
      byKey.set(key, entry);
    }
  }

  const sinceKey = dateKeyInTz(since, timezone);
  const rows = Array.from(byKey.values()).map(r => ({ merchantId, ...r }));

  // Pencere içini tam değiştir; pencere dışı (eski) günler tarihsel arşiv olarak kalır.
  await prisma.$transaction([
    prisma.salesDaily.deleteMany({ where: { merchantId, date: { gte: sinceKey } } }),
    prisma.salesDaily.createMany({ data: rows }),
  ]);

  return rows.length;
}

/** Ürün + sipariş sync'ini çalıştırır, SyncLog'a yazar. */
export async function runFullSync(merchantId: string, authToken: AuthToken): Promise<FullSyncResult> {
  const existing = inFlight.get(merchantId);
  if (existing) return existing;

  const promise = (async () => {
    const startedAt = new Date();
    try {
      const [productCount, salesDayCount] = [
        await syncProducts(merchantId, authToken),
        await syncOrders(merchantId, authToken),
      ];
      await prisma.syncLog.create({
        data: {
          merchantId,
          type: 'full',
          status: 'success',
          itemCount: productCount + salesDayCount,
          startedAt,
        },
      });
      // Taze veri üzerinde alarm kurallarını çalıştır (hata sync'i kırmaz,
      // evaluateAlerts kendi içinde yutar). Dinamik import döngüsel bağımlılığı önler.
      const { evaluateAlerts } = await import('@/lib/alerts/evaluate');
      await evaluateAlerts(merchantId);
      return { productCount, salesDayCount };
    } catch (error) {
      await prisma.syncLog.create({
        data: {
          merchantId,
          type: 'full',
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
          startedAt,
        },
      }).catch(() => undefined);
      throw error;
    } finally {
      inFlight.delete(merchantId);
    }
  })();

  inFlight.set(merchantId, promise);
  return promise;
}

/**
 * Tek bir ürünün snapshot'ını ikas'tan tazeler (webhook ile tetiklenir).
 * Ürün ikas'ta silinmişse snapshot satırları da silinir.
 */
export async function refreshProductSnapshot(
  merchantId: string,
  authToken: AuthToken,
  productId: string,
): Promise<void> {
  const ikasClient = getIkas(authToken);
  const res = await ikasClient.queries.listProduct({
    id: { eq: productId },
    pagination: { page: 1, limit: 1 },
  });
  if (!res.isSuccess) throw new Error(`refreshProductSnapshot: listProduct failed for ${productId}`);

  const product = res.data?.listProduct?.data?.[0];
  const syncedAt = new Date();

  if (!product) {
    // Ürün silinmiş — snapshot'tan da kaldır.
    await prisma.productSnapshot.deleteMany({ where: { merchantId, productId } });
    return;
  }

  const rows = product.variants.map(variant => ({
    merchantId,
    productId: product.id,
    productName: product.name,
    vendorId: product.vendor?.id ?? null,
    vendorName: product.vendor?.name ?? null,
    brandId: product.brand?.id ?? null,
    brandName: product.brand?.name ?? null,
    categoriesJson: product.categories ? JSON.stringify(product.categories) : null,
    variantId: variant.id,
    sku: variant.sku ?? null,
    imageUrl: pickMainImageUrl(merchantId, variant.images) ?? null,
    variantValuesJson: variant.variantValues ? JSON.stringify(variant.variantValues) : null,
    totalStock: (variant.stocks ?? []).reduce((s, st) => s + (st.stockCount ?? 0), 0),
    sellPrice: variant.prices?.[0]?.sellPrice ?? 0,
    buyPrice: variant.prices?.[0]?.buyPrice ?? null,
    currencyCode: variant.prices?.[0]?.currencyCode ?? null,
    syncedAt,
  }));

  // Ürünün eski varyant satırlarını tam listeyle değiştir (silinen varyantlar kalmasın).
  await prisma.$transaction([
    prisma.productSnapshot.deleteMany({ where: { merchantId, productId } }),
    prisma.productSnapshot.createMany({ data: rows }),
  ]);
}

/**
 * Sipariş verisini "kirli" işaretler — bir sonraki analytics okuması,
 * staleness süresi dolmamış olsa bile yeniden sync tetikler.
 * (Order webhook'ları event bazlı artımlı yazmak yerine bunu kullanır:
 * ikas retry/update senaryolarında çift sayma riski yok.)
 */
export async function invalidateSync(merchantId: string): Promise<void> {
  await prisma.syncLog.create({
    data: {
      merchantId,
      type: 'invalidate',
      status: 'success',
      startedAt: new Date(),
    },
  });
}

/**
 * Son başarılı sync maxAge'den eskiyse yeniler.
 * Sync başarısız olursa (ikas erişilemez vb.) mevcut stale veriyle devam
 * edilebilsin diye hata YUTULUR, false döner — çağıran taraf DB'den okur.
 *
 * @returns sync bu çağrıda çalıştıysa true
 */
export async function ensureFreshSync(
  merchantId: string,
  authToken: AuthToken,
  maxAgeMinutes: number = SYNC_MAX_AGE_MINUTES,
): Promise<boolean> {
  const [last, lastInvalidate] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { merchantId, type: 'full', status: 'success' },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.syncLog.findFirst({
      where: { merchantId, type: 'invalidate' },
      orderBy: { finishedAt: 'desc' },
    }),
  ]);

  const invalidated =
    last && lastInvalidate && lastInvalidate.finishedAt.getTime() > last.finishedAt.getTime();
  const isFresh =
    !invalidated && last && Date.now() - last.finishedAt.getTime() < maxAgeMinutes * 60_000;
  if (isFresh) return false;

  try {
    await runFullSync(merchantId, authToken);
    return true;
  } catch (error) {
    logger.error('ensureFreshSync failed, serving stale data', { merchantId, error });
    return false;
  }
}
