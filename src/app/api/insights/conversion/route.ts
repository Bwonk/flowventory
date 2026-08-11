import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMerchantTimezone } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz } from '@/lib/timezone';
import { NextRequest, NextResponse } from 'next/server';

/** Analiz penceresi (gün). */
const WINDOW_DAYS = 30;

/** "Düşük dönüşüm" bayrağı için minimum görüntülenme (istatistiksel gürültüyü ele). */
const MIN_VIEWS_FOR_FLAG = 20;

export type ConversionInsightItem = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  views: number;
  soldQty: number;
  revenue: number;
  /** soldQty / views (0-1). */
  conversionRate: number;
  /** Yeterli görüntülenmesi olup mağaza ortalamasının yarısının altında dönüşen ürün. */
  lowConversion: boolean;
};

export type ConversionInsightApiResponse = {
  windowDays: number;
  totalViews: number;
  totalSoldQty: number;
  /** Mağaza geneli dönüşüm oranı (0-1). */
  overallConversionRate: number;
  items: ConversionInsightItem[];
};

/**
 * GET /api/insights/conversion
 *
 * Görüntülenme → satış dönüşümü analizi. Tracker'ın topladığı ProductView
 * verisi ile SalesDaily satışlarını ürün bazında birleştirir.
 *
 * Amaç: "çok görüntülenen ama az satan" ürünleri yakalamak — fiyat, görsel
 * veya açıklama sorununun en güçlü sinyali.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { merchantId } = user;
    const timezone = await getMerchantTimezone(merchantId);

    const start = new Date();
    start.setDate(start.getDate() - WINDOW_DAYS);
    const startKey = dateKeyInTz(start, timezone);

    const [viewRows, salesRows, snapshots] = await Promise.all([
      prisma.productView.groupBy({
        by: ['productId'],
        where: { merchantId, date: { gte: startKey } },
        _sum: { viewCount: true },
      }),
      prisma.salesDaily.findMany({ where: { merchantId, date: { gte: startKey } } }),
      prisma.productSnapshot.findMany({ where: { merchantId } }),
    ]);

    // variantId → productId eşlemesi + ürün meta bilgisi
    const variantToProduct = new Map<string, string>();
    const productMeta = new Map<string, { name: string; imageUrl: string | null }>();
    for (const snap of snapshots) {
      variantToProduct.set(snap.variantId, snap.productId);
      if (!productMeta.has(snap.productId)) {
        productMeta.set(snap.productId, { name: snap.productName, imageUrl: snap.imageUrl });
      }
    }

    // Ürün bazında satış toplamı
    const salesByProduct = new Map<string, { qty: number; revenue: number }>();
    for (const row of salesRows) {
      const productId = variantToProduct.get(row.variantId);
      if (!productId) continue;
      const entry = salesByProduct.get(productId) ?? { qty: 0, revenue: 0 };
      entry.qty += row.quantity;
      entry.revenue += row.revenue;
      salesByProduct.set(productId, entry);
    }

    const totalViews = viewRows.reduce((s, r) => s + (r._sum.viewCount ?? 0), 0);
    const totalSoldQty = Array.from(salesByProduct.values()).reduce((s, e) => s + e.qty, 0);
    const overallConversionRate = totalViews > 0 ? totalSoldQty / totalViews : 0;

    const items: ConversionInsightItem[] = viewRows
      .map(row => {
        const views = row._sum.viewCount ?? 0;
        const meta = productMeta.get(row.productId);
        const sales = salesByProduct.get(row.productId) ?? { qty: 0, revenue: 0 };
        const conversionRate = views > 0 ? sales.qty / views : 0;
        return {
          productId: row.productId,
          productName: meta?.name ?? row.productId,
          imageUrl: meta?.imageUrl ?? null,
          views,
          soldQty: sales.qty,
          revenue: Math.round(sales.revenue * 100) / 100,
          conversionRate: Math.round(conversionRate * 10000) / 10000,
          lowConversion:
            views >= MIN_VIEWS_FOR_FLAG &&
            overallConversionRate > 0 &&
            conversionRate < overallConversionRate / 2,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    const data: ConversionInsightApiResponse = {
      windowDays: WINDOW_DAYS,
      totalViews,
      totalSoldQty,
      overallConversionRate: Math.round(overallConversionRate * 10000) / 10000,
      items,
    };

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Conversion insight error', { error });
    return NextResponse.json({ error: 'Failed to build conversion insight' }, { status: 500 });
  }
}
