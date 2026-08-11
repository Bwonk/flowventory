import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { buildMockAnalytics } from '@/lib/mock-analytics';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

export type AnalyticsApiResponse = {
  totalRevenue: number;
  revenueChange: number;
  dailyRevenue: Array<{ date: string; revenue: number }>;
  salesByVariant: Array<{ variantId: string; sku: string; revenue: number; quantity: number }>;
};

function shouldUseMockAnalytics(hasOrders: boolean, request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (request.nextUrl.searchParams.get('mock') === '1') return true;
  if (process.env.MOCK_ANALYTICS === '1') return true;
  // Sipariş yoksa chart'lar boş kalmasın (admin app createOrder engelli)
  return !hasOrders;
}

/**
 * GET /api/ikas/analytics
 *
 * Satış analitiği — SalesDaily tablosundan okur (sync katmanı).
 * Staleness kontrolü: son başarılı sync 30 dk'dan eskiyse önce yeniler;
 * ikas erişilemezse eldeki (stale) veriyle devam eder.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const { merchantId } = user;
    await ensureFreshSync(merchantId, authToken);

    const { timezone } = await getMerchantSettings(merchantId);
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(now.getDate() - 30);
    const prevStart = new Date(now);
    prevStart.setDate(now.getDate() - 60);

    const recentStartKey = dateKeyInTz(recentStart, timezone);
    const prevStartKey = dateKeyInTz(prevStart, timezone);

    const rows = await prisma.salesDaily.findMany({
      where: { merchantId, date: { gte: prevStartKey } },
    });

    const recent = rows.filter(r => r.date >= recentStartKey);
    const previous = rows.filter(r => r.date < recentStartKey);

    if (shouldUseMockAnalytics(recent.length > 0, request)) {
      // Mock, snapshot'taki gerçek ürünlerden üretilir (ikas'a gitmeden).
      const snapshotRows = await prisma.productSnapshot.findMany({ where: { merchantId } });
      const byProduct = new Map<string, { name: string; variants: Array<{ id: string; sku: string | null; prices: Array<{ sellPrice: number }> }> }>();
      for (const row of snapshotRows) {
        const product = byProduct.get(row.productId) ?? { name: row.productName, variants: [] };
        product.variants.push({ id: row.variantId, sku: row.sku, prices: [{ sellPrice: row.sellPrice }] });
        byProduct.set(row.productId, product);
      }
      const mock = buildMockAnalytics(Array.from(byProduct.values()));
      return NextResponse.json({ data: mock, meta: { mocked: true } });
    }

    const totalRevenue = recent.reduce((sum, r) => sum + r.revenue, 0);
    const previousRevenue = previous.reduce((sum, r) => sum + r.revenue, 0);

    const revenueChange = previousRevenue === 0 ? 0 :
      Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100);

    const dailyMap = new Map<string, number>();
    for (const r of recent) {
      dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.revenue);
    }
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const variantMap = new Map<string, { sku: string; revenue: number; quantity: number }>();
    for (const r of recent) {
      const existing = variantMap.get(r.variantId) ?? { sku: r.sku || r.variantId, revenue: 0, quantity: 0 };
      existing.revenue += r.revenue;
      existing.quantity += r.quantity;
      variantMap.set(r.variantId, existing);
    }

    // TAM liste — top-N kesintisi yok. "En çok satanlar" gibi görünümler
    // kendi slice'ını yapar; ölü stok / stok ömrü hesapları tüm veriye bakar.
    const salesByVariant = Array.from(variantMap.entries())
      .map(([variantId, data]) => ({ variantId, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      data: { totalRevenue, revenueChange, dailyRevenue, salesByVariant },
    });
  } catch (error) {
    logger.error('Analytics error:', { error });
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
