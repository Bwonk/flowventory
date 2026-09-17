import { NextRequest, NextResponse } from 'next/server';
import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { computeUndoCount } from '@/lib/rules/actions-catalog';
import { parseActionResults, toEventItem, type RuleEventItem } from '@/lib/rules/serialize';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';

type RouteContext = { params: Promise<{ id: string; eventId: string }> };

export type UndoRuleStockApiResponse = { event: RuleEventItem; previousCount: number; newCount: number };

/**
 * POST /api/rules/:id/events/:eventId/undo
 *
 * Kuralın stok yazımını geri alır: ilgili deponun canlı stoğundan kuralın
 * eklediği fark çıkarılır (arada satış olduysa korunur) ve sonuç
 * `undoneAt` ile işaretlenir. Bir yazım bir kez geri alınır.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    const { id, eventId } = await context.params;

    const event = await prisma.trackingRuleEvent.findFirst({ where: { id: eventId, ruleId: id, merchantId: user.merchantId } });
    if (!event || !event.variantId) return NextResponse.json({ error: 'Tetik bulunamadı' }, { status: 404 });

    const results = parseActionResults(event.actionsJson);
    const write = results.find(r => r.type === 'adjust_stock' && r.ok && r.stock)?.stock;
    if (!write) return NextResponse.json({ error: 'Geri alınacak stok yazımı yok' }, { status: 409 });
    if (write.undoneAt) return NextResponse.json({ error: 'Bu yazım zaten geri alındı' }, { status: 409 });

    const ikasClient = getIkas(authToken);
    const productRes = await ikasClient.queries.listProduct({ id: { eq: event.productId }, pagination: { page: 1, limit: 1 } });
    if (!productRes.isSuccess) return NextResponse.json({ error: 'Stok okunamadı' }, { status: 502 });
    const variant = productRes.data?.listProduct?.data?.[0]?.variants.find(v => v.id === event.variantId);
    const location = variant?.stocks?.find(s => s?.stockLocationId === write.stockLocationId);
    if (!variant || !location) return NextResponse.json({ error: 'Varyant ya da depo bulunamadı' }, { status: 404 });

    const liveCount = location.stockCount ?? 0;
    const newCount = computeUndoCount(liveCount, write);
    const response = await ikasClient.mutations.saveVariantStocks({
      input: {
        stockInputs: [
          { productId: event.productId, variantId: event.variantId, stockLocationId: write.stockLocationId, stockCount: newCount },
        ],
      },
    });
    const errors = response.data?.saveVariantStocks?.errors;
    if (!response.isSuccess || !response.data?.saveVariantStocks || (errors && errors.length > 0)) {
      logger.error('Rule stock undo rejected', { errors });
      return NextResponse.json({ error: 'Stok geri alınamadı' }, { status: 502 });
    }

    write.undoneAt = new Date().toISOString();
    const updated = await prisma.trackingRuleEvent.update({
      where: { id: event.id },
      data: { actionsJson: JSON.stringify(results) },
    });

    await refreshProductSnapshot(user.merchantId, authToken, event.productId).catch(error => {
      logger.warn('Snapshot refresh after rule undo failed', { productId: event.productId, error });
    });

    const data: UndoRuleStockApiResponse = { event: toEventItem(updated), previousCount: liveCount, newCount };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Rule stock undo error', { error });
    return NextResponse.json({ error: 'Stok geri alınamadı' }, { status: 500 });
  }
}
