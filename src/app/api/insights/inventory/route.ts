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
import { percentDelta } from '@/lib/reports/trend';
import { ensureFreshSync, ORDER_SYNC_WINDOW_DAYS } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

/**
 * İzin verilen analiz pencereleri. 60 gün üst sınır: sync yalnızca son
 * ORDER_SYNC_WINDOW_DAYS (60) günü garanti eder; daha eski SalesDaily
 * satırları arşiv-niteliğinde olduğundan pencereye açılmaz. window=60'ta
 * "önceki dönem" verisi garanti edilemediği için trend alanları null döner.
 */
const DEFAULT_WINDOW_DAYS = 30;
const EXTENDED_WINDOW_DAYS = 60;

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
  /** Dönem brüt kârı: ciro − satılan × birim maliyet. */
  profit: number;
  /** Kâr Pareto'suna göre sınıf — Ciro|Kâr toggle'ı için. */
  profitAbcClass: AbcClass;
  /** Kâr, alış fiyatı eksik varyant(lar) yüzünden yaklaşık mı? */
  profitIsEstimate: boolean;
  /** Önceki eşit döneme göre ciro değişimi (%). window=60 ya da önceki dönem boşsa null. */
  revenueTrendPct: number | null;
};

export type InventoryInsightApiResponse = {
  windowDays: number;
  /** MerchantSettings'teki tedarik süresi — tükeniş riski bu eşiğe göre. */
  leadTimeDays: number;
  /** MerchantSettings'teki hedef stok günü — client'taki aksiyon kuralları için. */
  targetStockDays: number;
  abcSummary: Array<{
    class: AbcClass;
    productCount: number;
    revenueShare: number;
    stockValue: number;
  }>;
  /** Kâr Pareto'suna göre sınıf özetleri — Ciro|Kâr toggle'ı refetch'siz çalışsın diye. */
  abcSummaryProfit: Array<{
    class: AbcClass;
    productCount: number;
    profitShare: number;
    profit: number;
    stockValue: number;
  }>;
  /** Mağaza geneli dönem karşılaştırması. window=60'ta null (önceki dönem garanti değil). */
  trend: {
    revenueCurrent: number;
    revenuePrevious: number;
    revenueDeltaPct: number | null;
    soldUnitsDeltaPct: number | null;
  } | null;
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

    // Pencere whitelist ile seçilir; geçersiz/boş değer sessizce varsayılana düşer.
    const windowDays =
      request.nextUrl.searchParams.get('window') === String(EXTENDED_WINDOW_DAYS)
        ? EXTENDED_WINDOW_DAYS
        : DEFAULT_WINDOW_DAYS;

    const { timezone, leadTimeDays, targetStockDays } = await getMerchantSettings(merchantId);
    // Satışlar her zaman sync garantisinin tamamı (60 gün) kadar çekilir;
    // pencere sınırında ikiye bölünür: güncel dönem + (window=30 ise) önceki dönem.
    const fetchStart = new Date();
    fetchStart.setDate(fetchStart.getDate() - ORDER_SYNC_WINDOW_DAYS);
    const fetchStartKey = dateKeyInTz(fetchStart, timezone);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);
    const windowStartKey = dateKeyInTz(windowStart, timezone);

    const [snapshots, salesRows] = await Promise.all([
      prisma.productSnapshot.findMany({ where: { merchantId } }),
      prisma.salesDaily.findMany({ where: { merchantId, date: { gte: fetchStartKey } } }),
    ]);

    // Varyant satışlarını ürüne topla; kâr için varyant bazında birim maliyet gerekir
    // (buyPrice yoksa sellPrice → 0 marj, profitIsEstimate ile işaretlenir).
    const variantToProduct = new Map<string, string>();
    const variantCost = new Map<string, { unitCost: number; hasBuyPrice: boolean }>();
    for (const snap of snapshots) {
      variantToProduct.set(snap.variantId, snap.productId);
      variantCost.set(snap.variantId, {
        unitCost: snap.buyPrice ?? snap.sellPrice,
        hasBuyPrice: snap.buyPrice != null,
      });
    }

    const salesByProduct = new Map<
      string,
      { qty: number; revenue: number; profit: number; profitIsEstimate: boolean }
    >();
    const prevSalesByProduct = new Map<string, { qty: number; revenue: number }>();
    for (const row of salesRows) {
      const productId = variantToProduct.get(row.variantId);
      if (!productId) continue;
      if (row.date >= windowStartKey) {
        const entry =
          salesByProduct.get(productId) ?? { qty: 0, revenue: 0, profit: 0, profitIsEstimate: false };
        entry.qty += row.quantity;
        entry.revenue += row.revenue;
        const cost = variantCost.get(row.variantId);
        entry.profit += row.revenue - row.quantity * (cost?.unitCost ?? 0);
        entry.profitIsEstimate = entry.profitIsEstimate || (!cost?.hasBuyPrice && row.quantity > 0);
        salesByProduct.set(productId, entry);
      } else {
        // window=60'ta bu dala hiç düşülmez (fetch başlangıcı = pencere başlangıcı).
        const entry = prevSalesByProduct.get(productId) ?? { qty: 0, revenue: 0 };
        entry.qty += row.quantity;
        entry.revenue += row.revenue;
        prevSalesByProduct.set(productId, entry);
      }
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
    // Kâr Pareto'su aynı sınıflandırıcıyla: girdisi ciro yerine brüt kâr (≤0 → C).
    const profitAbcMap = classifyAbc(
      Array.from(products.keys()).map(productId => ({
        id: productId,
        revenue: salesByProduct.get(productId)?.profit ?? 0,
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
      const sales =
        salesByProduct.get(agg.productId) ?? { qty: 0, revenue: 0, profit: 0, profitIsEstimate: false };
      const daysOfStock = daysUntilStockout(agg.totalStock, sales.qty, windowDays);
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
        profit: Math.round(sales.profit * 100) / 100,
        profitAbcClass: profitAbcMap.get(agg.productId) ?? 'C',
        profitIsEstimate: sales.profitIsEstimate,
        revenueTrendPct:
          windowDays === DEFAULT_WINDOW_DAYS
            ? percentDelta(sales.revenue, prevSalesByProduct.get(agg.productId)?.revenue ?? 0)
            : null,
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

    const totalProfit = items.reduce((s, i) => s + i.profit, 0);
    const abcSummaryProfit = (['A', 'B', 'C'] as AbcClass[]).map(cls => {
      const classItems = items.filter(i => i.profitAbcClass === cls);
      const profit = classItems.reduce((s, i) => s + i.profit, 0);
      return {
        class: cls,
        productCount: classItems.length,
        profitShare: totalProfit > 0 ? Math.round((profit / totalProfit) * 1000) / 1000 : 0,
        profit: Math.round(profit * 100) / 100,
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
    const overallTurnover = annualTurnoverRate(soldUnits, windowDays, stockUnits);

    // Mağaza geneli dönem karşılaştırması — yalnızca 30 günlük pencerede
    // (60 günde önceki dönem sync garantisinin dışında kalır).
    const prevRevenue = Array.from(prevSalesByProduct.values()).reduce((s, e) => s + e.revenue, 0);
    const prevUnits = Array.from(prevSalesByProduct.values()).reduce((s, e) => s + e.qty, 0);
    const trend =
      windowDays === DEFAULT_WINDOW_DAYS
        ? {
            revenueCurrent: Math.round(totalRevenue * 100) / 100,
            revenuePrevious: Math.round(prevRevenue * 100) / 100,
            revenueDeltaPct: percentDelta(totalRevenue, prevRevenue),
            soldUnitsDeltaPct: percentDelta(soldUnits, prevUnits),
          }
        : null;

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
      windowDays,
      leadTimeDays,
      targetStockDays,
      abcSummary,
      abcSummaryProfit,
      trend,
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
