import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_STOCK = 1_000_000;

const quickStockSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  addQty: z.number().int().min(1).max(100_000),
});

export type QuickStockApiResponse = {
  /** Geri Al hedefi: hedef deponun önceki mutlak stoğu. */
  previousCount: number;
  /** Hedef deponun yeni mutlak stoğu (previousCount + addQty). */
  newCount: number;
  /** Tüm depoların yeni toplamı — satırdaki Stok hücresi bunu gösterir. */
  newTotalStock: number;
  stockLocationId: string;
};

/**
 * POST /api/ikas/quick-stock
 *
 * Rapor satırından tek tıkla stok girişi: önerilen adedi mevcut stoğun
 * üzerine ekleyip ikas'a yazar. Rapor snapshot'ı bayat olabileceğinden
 * mevcut stok yazma anında ikas'tan canlı okunur; saveVariantStocks
 * mutlak değer istediği için delta burada toplanır.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const parsed = quickStockSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { productId, variantId, addQty } = parsed.data;

    const ikasClient = getIkas(authToken);
    const productRes = await ikasClient.queries.listProduct({
      id: { eq: productId },
      pagination: { page: 1, limit: 1 },
    });
    if (!productRes.isSuccess) {
      return NextResponse.json({ error: 'Stok girilemedi' }, { status: 502 });
    }

    const product = productRes.data?.listProduct?.data?.[0];
    const variant = product?.variants.find(v => v.id === variantId);
    if (!product || !variant) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
    }

    const locations = (variant.stocks ?? []).filter(s => s?.stockLocationId);
    if (locations.length === 0) {
      return NextResponse.json({ error: 'Stok deposu bulunamadı' }, { status: 422 });
    }

    // Hedef her zaman ilk depo — StockEditor'ün "DEPO 1" sıralamasıyla aynı.
    const target = locations[0];
    const previousCount = target.stockCount ?? 0;
    const newCount = previousCount + addQty;
    if (newCount > MAX_STOCK) {
      return NextResponse.json({ error: 'Stok üst sınırı aşılıyor' }, { status: 422 });
    }

    const response = await ikasClient.mutations.saveVariantStocks({
      input: {
        stockInputs: [
          { productId, variantId, stockLocationId: target.stockLocationId, stockCount: newCount },
        ],
      },
    });

    if (!response.isSuccess || !response.data?.saveVariantStocks) {
      return NextResponse.json({ error: 'Stok girilemedi' }, { status: 502 });
    }
    const errors = response.data.saveVariantStocks.errors;
    if (errors && errors.length > 0) {
      logger.error('saveVariantStocks returned errors', { errors });
      return NextResponse.json({ error: 'Stok girilemedi', details: errors }, { status: 502 });
    }

    // Yerel snapshot'ı hemen tazele — dashboard/analiz yeni değeri görsün.
    await refreshProductSnapshot(user.merchantId, authToken, productId).catch(error => {
      // Snapshot tazeleme başarısızsa webhook/staleness zaten yetişir; kritik değil.
      logger.warn('Snapshot refresh after quick stock failed', { productId, error });
    });

    const newTotalStock =
      locations.reduce((sum, l) => sum + (l.stockCount ?? 0), 0) + addQty;

    const data: QuickStockApiResponse = {
      previousCount,
      newCount,
      newTotalStock,
      stockLocationId: target.stockLocationId,
    };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Quick stock error', { error });
    return NextResponse.json({ error: 'Stok girilemedi' }, { status: 500 });
  }
}
