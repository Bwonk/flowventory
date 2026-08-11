import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateStockSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  stockLocationId: z.string().min(1),
  stockCount: z.number().int().min(0).max(1_000_000),
});

export type UpdateStockApiResponse = {
  ok: boolean;
};

/**
 * POST /api/ikas/update-stock
 *
 * Tek varyantın stok adedini ikas'a yazar (saveVariantStocks) ve yerel
 * snapshot'ı tazeler. Uygulamayı salt-okunur bir izleme aracından, işlem
 * yapılabilen bir araca çeviren endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const parsed = updateStockSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { productId, variantId, stockLocationId, stockCount } = parsed.data;

    const ikasClient = getIkas(authToken);
    const response = await ikasClient.mutations.saveVariantStocks({
      input: {
        stockInputs: [{ productId, variantId, stockLocationId, stockCount }],
      },
    });

    if (!response.isSuccess || !response.data?.saveVariantStocks) {
      return NextResponse.json({ error: 'Stok güncellenemedi' }, { status: 502 });
    }

    const errors = response.data.saveVariantStocks.errors;
    if (errors && errors.length > 0) {
      logger.error('saveVariantStocks returned errors', { errors });
      return NextResponse.json({ error: 'Stok güncellenemedi', details: errors }, { status: 502 });
    }

    // Yerel snapshot'ı hemen tazele — dashboard/analiz yeni değeri görsün.
    await refreshProductSnapshot(user.merchantId, authToken, productId).catch(error => {
      // Snapshot tazeleme başarısızsa webhook/staleness zaten yetişir; kritik değil.
      logger.warn('Snapshot refresh after stock update failed', { productId, error });
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error('Update stock error', { error });
    return NextResponse.json({ error: 'Stok güncellenemedi' }, { status: 500 });
  }
}
