import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMerchantTimezone } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { AGING_BUCKET_ORDER, agingBucket, classifyAbc, type AbcClass, type AgingBucketKey } from '@/lib/reports/abc';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

const WINDOW_DAYS = 30;

export type InventoryInsightItem = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  abcClass: AbcClass;
  revenue: number;
  soldQty: number;
  totalStock: number;
  stockValue: number;
  /** Mevcut stok kaç günlük satışa yetiyor (satış yoksa null). */
  daysOfStock: number | null;
  agingBucket: AgingBucketKey;
  /** stockValue alış fiyatı yerine satış fiyatından mı hesaplandı? */
  isEstimate: boolean;
};

export type InventoryInsightApiResponse = {
  windowDays: number;
  abcSummary: Array<{
    class: AbcClass;
    productCount: number;
    revenueShare: number;
    stockValue: number;
  }>;
  agingBuckets: Array<{
    bucket: AgingBucketKey;
    productCount: number;
    stockValue: number;
  }>;
  items: InventoryInsightItem[];
};

/**
 * GET /api/insights/inventory
 *
 * ABC analizi (ciro Pareto'su) + stok yaşlandırma raporu.
 * ProductSnapshot + SalesDaily'den ürün bazında hesaplanır.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const { merchantId } = user;
    await ensureFreshSync(merchantId, authToken);

    const timezone = await getMerchantTimezone(merchantId);
    const start = new Date();
    start.setDate(start.getDate() - WINDOW_DAYS);
    const startKey = dateKeyInTz(start, timezone);

    const [snapshots, salesRows] = await Promise.all([
      prisma.productSnapshot.findMany({ where: { merchantId } }),
      prisma.salesDaily.findMany({ where: { merchantId, date: { gte: startKey } } }),
    ]);

    // Varyant satışlarını ürüne topla
    const variantToProduct = new Map<string, string>();
    for (const snap of snapshots) variantToProduct.set(snap.variantId, snap.productId);

    const salesByProduct = new Map<string, { qty: number; revenue: number }>();
    for (const row of salesRows) {
      const productId = variantToProduct.get(row.variantId);
      if (!productId) continue;
      const entry = salesByProduct.get(productId) ?? { qty: 0, revenue: 0 };
      entry.qty += row.quantity;
      entry.revenue += row.revenue;
      salesByProduct.set(productId, entry);
    }

    // Ürün bazında stok + maliyet toplamı
    type ProductAgg = {
      productId: string;
      productName: string;
      imageUrl: string | null;
      totalStock: number;
      stockValue: number;
      isEstimate: boolean;
    };
    const products = new Map<string, ProductAgg>();
    for (const snap of snapshots) {
      const agg = products.get(snap.productId) ?? {
        productId: snap.productId,
        productName: snap.productName,
        imageUrl: snap.imageUrl,
        totalStock: 0,
        stockValue: 0,
        isEstimate: false,
      };
      const unitCost = snap.buyPrice ?? snap.sellPrice;
      agg.totalStock += snap.totalStock;
      agg.stockValue += snap.totalStock * unitCost;
      agg.isEstimate = agg.isEstimate || (snap.buyPrice == null && snap.totalStock > 0);
      products.set(snap.productId, agg);
    }

    const abcMap = classifyAbc(
      Array.from(products.keys()).map(productId => ({
        id: productId,
        revenue: salesByProduct.get(productId)?.revenue ?? 0,
      })),
    );

    const totalRevenue = Array.from(salesByProduct.values()).reduce((s, e) => s + e.revenue, 0);

    const items: InventoryInsightItem[] = Array.from(products.values()).map(agg => {
      const sales = salesByProduct.get(agg.productId) ?? { qty: 0, revenue: 0 };
      const dailyAvg = sales.qty / WINDOW_DAYS;
      const daysOfStock =
        dailyAvg > 0 && agg.totalStock > 0 ? Math.round(agg.totalStock / dailyAvg) : agg.totalStock > 0 ? null : 0;
      // Stok 0 ise yaşlandırmaya girmez (0 günlük) — "0-30" kovasında sayılır.
      const bucket = agingBucket(daysOfStock);
      return {
        productId: agg.productId,
        productName: agg.productName,
        imageUrl: agg.imageUrl,
        abcClass: abcMap.get(agg.productId) ?? 'C',
        revenue: Math.round(sales.revenue * 100) / 100,
        soldQty: sales.qty,
        totalStock: agg.totalStock,
        stockValue: Math.round(agg.stockValue * 100) / 100,
        daysOfStock,
        agingBucket: bucket,
        isEstimate: agg.isEstimate,
      };
    });

    const abcSummary = (['A', 'B', 'C'] as AbcClass[]).map(cls => {
      const classItems = items.filter(i => i.abcClass === cls);
      return {
        class: cls,
        productCount: classItems.length,
        revenueShare:
          totalRevenue > 0
            ? Math.round((classItems.reduce((s, i) => s + i.revenue, 0) / totalRevenue) * 1000) / 1000
            : 0,
        stockValue: Math.round(classItems.reduce((s, i) => s + i.stockValue, 0) * 100) / 100,
      };
    });

    const agingBuckets = AGING_BUCKET_ORDER.map(bucket => {
      const bucketItems = items.filter(i => i.agingBucket === bucket && i.totalStock > 0);
      return {
        bucket,
        productCount: bucketItems.length,
        stockValue: Math.round(bucketItems.reduce((s, i) => s + i.stockValue, 0) * 100) / 100,
      };
    });

    const data: InventoryInsightApiResponse = {
      windowDays: WINDOW_DAYS,
      abcSummary,
      agingBuckets,
      items: items.sort((a, b) => b.revenue - a.revenue),
    };

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Inventory insight error', { error });
    return NextResponse.json({ error: 'Failed to build inventory insight' }, { status: 500 });
  }
}
