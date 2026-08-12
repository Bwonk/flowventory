import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { AGING_BUCKET_ORDER, agingBucket, classifyAbc, type AbcClass, type AgingBucketKey } from '@/lib/reports/abc';
import {
  annualTurnoverRate,
  daysUntilStockout,
  isStockoutBeforeLeadTime,
  isWithinForecastHorizon,
  overallSellThrough,
  sellThroughBand,
  sellThroughRate,
  type SellThroughBand,
} from '@/lib/reports/sell-through';
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
  /** Dönemde satılan ÷ (satılan + kalan) — 0..1, veri yoksa null. */
  sellThrough: number | null;
  sellThroughBand: SellThroughBand | null;
  /**
   * Tahmini tükeniş tarihi ("2026-09-01").
   * Satış yoksa ya da tahmin 2 yıldan uzaksa null — bkz. daysOfStock.
   */
  stockoutDate: string | null;
  /** Tedarik süresi dolmadan tükenecek mi? */
  stockoutBeforeLeadTime: boolean;
  /** stockValue alış fiyatı yerine satış fiyatından mı hesaplandı? */
  isEstimate: boolean;
};

export type InventoryInsightApiResponse = {
  windowDays: number;
  /** MerchantSettings'teki tedarik süresi — tükeniş riski bu eşiğe göre. */
  leadTimeDays: number;
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
  sellThroughSummary: {
    /** Adet ağırlıklı mağaza geneli sell-through (0..1, veri yoksa null). */
    overall: number | null;
    soldUnits: number;
    stockUnits: number;
    /** Mağaza geneli yıllık devir katsayısı — yaklaşık. */
    turnoverRate: number | null;
    /** Bant başına ürün sayısı. */
    bandCounts: Record<SellThroughBand, number>;
    /** Tedarik süresi dolmadan tükenecek ürünler (ciroya göre sıralı, ilk 5). */
    stockoutRisk: Array<{
      productId: string;
      productName: string;
      totalStock: number;
      daysOfStock: number | null;
      stockoutDate: string | null;
    }>;
    stockoutRiskCount: number;
  };
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

    const { timezone, leadTimeDays } = await getMerchantSettings(merchantId);
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

    const now = new Date();
    /** Bugünden `days` gün sonrasının merchant TZ'sindeki tarih anahtarı. */
    const dateKeyAfter = (days: number) => {
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      return dateKeyInTz(target, timezone);
    };

    const items: InventoryInsightItem[] = Array.from(products.values()).map(agg => {
      const sales = salesByProduct.get(agg.productId) ?? { qty: 0, revenue: 0 };
      const daysOfStock = daysUntilStockout(agg.totalStock, sales.qty, WINDOW_DAYS);
      // Stok 0 ise yaşlandırmaya girmez (0 günlük) — "0-30" kovasında sayılır.
      // Ürün bazında devir hızı ayrıca taşınmıyor: tek satırda 365/daysOfStock'a
      // eşit, yani zaten "Stok Ömrü" sütununun bilgisi. Mağaza geneli devir
      // toplamlardan hesaplandığı için satırlardan türetilemez, o özette var.
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
        sellThrough: sellThroughRate(sales.qty, agg.totalStock),
        sellThroughBand: sellThroughBand(sales.qty, agg.totalStock),
        stockoutDate: isWithinForecastHorizon(daysOfStock) ? dateKeyAfter(daysOfStock) : null,
        stockoutBeforeLeadTime: isStockoutBeforeLeadTime(daysOfStock, leadTimeDays),
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

    const sortedItems = items.sort((a, b) => b.revenue - a.revenue);

    const soldUnits = sortedItems.reduce((s, i) => s + i.soldQty, 0);
    const stockUnits = sortedItems.reduce((s, i) => s + i.totalStock, 0);
    const overallTurnover = annualTurnoverRate(soldUnits, WINDOW_DAYS, stockUnits);

    const bandCounts: Record<SellThroughBand, number> = {
      yüksek: 0,
      normal: 0,
      düşük: 0,
      satışsız: 0,
    };
    for (const item of sortedItems) {
      if (item.sellThroughBand) bandCounts[item.sellThroughBand] += 1;
    }

    // Stoğu bitmiş ürünler zaten "tükendi" listesinde; burada asıl uyarı,
    // hâlâ stoğu olduğu hâlde tedarik süresinden önce bitecek olanlar.
    const atRisk = sortedItems.filter(i => i.stockoutBeforeLeadTime && i.totalStock > 0);

    const data: InventoryInsightApiResponse = {
      windowDays: WINDOW_DAYS,
      leadTimeDays,
      abcSummary,
      agingBuckets,
      sellThroughSummary: {
        overall: overallSellThrough({ soldUnits, stockUnits }),
        soldUnits,
        stockUnits,
        turnoverRate: overallTurnover === null ? null : Math.round(overallTurnover * 100) / 100,
        bandCounts,
        stockoutRisk: atRisk.slice(0, 5).map(i => ({
          productId: i.productId,
          productName: i.productName,
          totalStock: i.totalStock,
          daysOfStock: i.daysOfStock,
          stockoutDate: i.stockoutDate,
        })),
        stockoutRiskCount: atRisk.length,
      },
      items: sortedItems,
    };

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Inventory insight error', { error });
    return NextResponse.json({ error: 'Failed to build inventory insight' }, { status: 500 });
  }
}
