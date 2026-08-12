import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { prisma } from '@/lib/prisma';
import { seedSalesOrders } from '@/lib/seed-orders';

/**
 * POST /api/dev/seed-orders
 *
 * Son 30 güne yayılmış demo siparişler oluşturur (ciro + satış adedi chart'ı için).
 * Yalnızca development'ta çalışır.
 *
 * Auth:
 * - Authorization Bearer JWT (tercih)
 * - veya yerel DB'deki ilk AuthToken (dev kolaylığı)
 *
 * Body (opsiyonel): { "orderCount": 28 }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    let authToken: Awaited<ReturnType<typeof AuthTokenManager.get>> = undefined;

    const user = getUserFromRequest(request);
    if (user?.authorizedAppId) {
      authToken = await AuthTokenManager.get(user.authorizedAppId);
    }

    if (!authToken) {
      const row = await prisma.authToken.findFirst({ orderBy: { updatedAt: 'desc' } });
      if (row?.authorizedAppId) {
        authToken = await AuthTokenManager.get(row.authorizedAppId);
      }
    }

    if (!authToken) {
      return NextResponse.json(
        { error: 'AuthToken yok — uygulamayı ikas üzerinden yeniden yetkilendirin' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderCount =
      typeof body?.orderCount === 'number' && body.orderCount > 0 && body.orderCount <= 60
        ? Math.floor(body.orderCount)
        : 28;

    const result = await seedSalesOrders(authToken, { orderCount });

    if (result.skippedReason) {
      return NextResponse.json({ error: result.skippedReason }, { status: 400 });
    }

    const totalRevenue = result.created.reduce((s, o) => s + (o.totalFinalPrice || 0), 0);

    return NextResponse.json({
      data: {
        createdCount: result.created.length,
        variantCount: result.variantCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        orders: result.created.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          orderedAt: o.orderedAt,
          totalFinalPrice: o.totalFinalPrice,
        })),
      },
    });
  } catch (error) {
    logger.error('seed-orders error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 },
    );
  }
}
