'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  CheckCircle,
  Eye,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { ListProductsApiResponse } from '../api/ikas/list-products/route';
import { AnalyticsApiResponse } from '../api/ikas/analytics/route';
import type { DailyViewStatsResponse } from '../api/product-view/stats/route';
import { useStockThreshold } from '@/lib/stock-threshold';
import { getTotalStock, getDaysRemaining } from '@/components/home-page/lib/product';
import { ProductListCard, type ProductListItem } from './components/ProductListCard';
import { TrendChart, type TrendDataPoint } from '@/components/shared/TrendChart';

type Product = NonNullable<ListProductsApiResponse['products']>[0];
type Variant = Product['variants'][number];
function formatPrice(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

function minStock(product: Product): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map(v => v.stocks?.[0]?.stockCount ?? 0));
}

function getProductThumbnail(product: Product): string | undefined {
  return product.variants.find(v => v.imageUrl)?.imageUrl;
}

export default function DashboardPage() {
  const [, setToken] = useState<string | null>(null);
  const [, setStoreName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [dailyViewStats, setDailyViewStats] = useState<DailyViewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const { threshold } = useStockThreshold();
  const { min: minThreshold, max: maxThreshold } = threshold;

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  const fetchStoreName = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.getMerchant(currentToken);
      if (res.status === 200 && res.data?.data?.merchantInfo?.storeName) {
        setStoreName(res.data.data.merchantInfo.storeName);
      }
    } catch (error) {
      console.error('Error fetching store name:', error);
    }
  }, []);

  const fetchProducts = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.listProducts(currentToken);
      if (res.status === 200 && res.data?.data?.products) {
        setProducts(res.data.data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const fetchAnalytics = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.getAnalytics(currentToken);
      if (res.status === 200 && res.data?.data) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  const fetchDailyViewStats = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.productView.getDailyViewStats(currentToken);
      if (res.status === 200 && res.data?.data) {
        setDailyViewStats(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching daily view stats:', error);
    }
  }, []);

  const initialize = useCallback(async () => {
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (fetchedToken) {
        await Promise.all([
          fetchStoreName(fetchedToken),
          fetchProducts(fetchedToken),
          fetchAnalytics(fetchedToken),
          fetchDailyViewStats(fetchedToken),
        ]);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStoreName, fetchProducts, fetchAnalytics, fetchDailyViewStats]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const totalStock = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + p.variants.reduce((s, v) => s + (v.stocks?.[0]?.stockCount ?? 0), 0),
        0,
      ),
    [products],
  );

  const criticalCount = useMemo(
    () => products.filter(p => p.variants.some(v => (v.stocks?.[0]?.stockCount ?? 0) === 0)).length,
    [products],
  );

  const warningCount = useMemo(
    () =>
      products.filter(
        p =>
          !p.variants.some(v => (v.stocks?.[0]?.stockCount ?? 0) === 0) &&
          p.variants.some(v => {
            const s = v.stocks?.[0]?.stockCount ?? 0;
            return s > 0 && s <= maxThreshold;
          }),
      ).length,
    [products, maxThreshold],
  );

  // Eşik altındaki (biten + azalan) tüm ürünler; en kritikten (0 stok) başlayarak sıralı.
  const lowStockProducts = useMemo(
    () =>
      products
        .filter(p => minStock(p) <= maxThreshold)
        .sort((a, b) => minStock(a) - minStock(b)),
    [products, maxThreshold],
  );

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const revenueChange = analytics?.revenueChange ?? 0;
  const isPositive = revenueChange >= 0;
  const topProducts = analytics?.topProducts ?? [];

  const dailyViewMap = useMemo(() => {
    const map = new Map<string, number>();
    if (dailyViewStats) {
      for (const d of dailyViewStats.dailyViews) {
        map.set(d.date, d.viewCount);
      }
    }
    return map;
  }, [dailyViewStats]);

  const dashboardTrendData: TrendDataPoint[] = useMemo(() => {
    const dailyRev = analytics?.dailyRevenue ?? [];
    const totalQty = topProducts.reduce((s, tp) => s + tp.quantity, 0);
    const totalDailyRev = dailyRev.reduce((s, d) => s + d.revenue, 0);

    return dailyRev.map(d => ({
      date: d.date,
      revenue: d.revenue,
      quantity: totalDailyRev > 0 ? Math.round((d.revenue / totalDailyRev) * totalQty) : 0,
      views: dailyViewMap.get(d.date) ?? 0,
    }));
  }, [analytics, topProducts, dailyViewMap]);

  // Ölü stok: satışı olmayan veya stok ömrü >180 gün olan ürünler.
  const deadStock = useMemo(() => {
    return products.filter(p => {
      const total = getTotalStock(p);
      if (total === 0) return false;
      const soldQty = topProducts
        .filter(tp => p.variants.some(v => v.id === tp.variantId))
        .reduce((s, tp) => s + tp.quantity, 0);
      if (soldQty === 0) return true;
      return Math.round(total / (soldQty / 30)) > 180;
    });
  }, [products, topProducts]);

  const deadStockCount = deadStock.length;

  const lockedCapital = useMemo(() => {
    return deadStock.reduce((sum, p) => {
      return sum + p.variants.reduce((s, v) => {
        const stock = v.stocks?.[0]?.stockCount ?? 0;
        const price = v.prices?.[0]?.sellPrice ?? 0;
        return s + stock * price;
      }, 0);
    }, 0);
  }, [deadStock]);

  // Varyant id -> ürün/varyant eşlemesi (isim, görsel, varyant değerleri için).
  const variantIndex = useMemo(() => {
    const map = new Map<string, { product: Product; variant: Variant }>();
    for (const product of products) {
      for (const variant of product.variants) {
        map.set(variant.id, { product, variant });
      }
    }
    return map;
  }, [products]);

  /**
   * En çok satanlar: satışları ürün bazında toplar, en çok satan varyantı seçer,
   * satılan adede (eşitlikte ciroya) göre sıralar ve ilk 10'u döndürür.
   */
  const topSellers = useMemo(() => {
    interface Aggregate {
      productName: string;
      quantity: number;
      revenue: number;
      best: { variantId: string; quantity: number; revenue: number } | null;
    }
    const byProduct = new Map<string, Aggregate>();

    for (const tp of topProducts) {
      const entry = variantIndex.get(tp.variantId);
      const productId = entry?.product.id ?? tp.variantId;
      const productName = entry?.product.name ?? tp.sku;
      const agg = byProduct.get(productId) ?? {
        productName,
        quantity: 0,
        revenue: 0,
        best: null,
      };
      agg.quantity += tp.quantity;
      agg.revenue += tp.revenue;
      if (
        !agg.best ||
        tp.quantity > agg.best.quantity ||
        (tp.quantity === agg.best.quantity && tp.revenue > agg.best.revenue)
      ) {
        agg.best = { variantId: tp.variantId, quantity: tp.quantity, revenue: tp.revenue };
      }
      byProduct.set(productId, agg);
    }

    return Array.from(byProduct.entries())
      .map(([key, agg]) => {
        const bestEntry = agg.best ? variantIndex.get(agg.best.variantId) : undefined;
        const variantName = bestEntry
          ? (bestEntry.variant.variantValues ?? [])
              .map(vv => vv.variantValueName)
              .filter((name): name is string => Boolean(name))
              .join(' · ') || null
          : null;
        const imageUrl =
          bestEntry?.variant.imageUrl ??
          (bestEntry ? getProductThumbnail(bestEntry.product) : undefined);
        return {
          key,
          productName: agg.productName,
          variantName,
          imageUrl,
          quantity: agg.quantity,
          revenue: agg.revenue,
        };
      })
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10);
  }, [topProducts, variantIndex]);

  const avgDaysRemaining = useMemo(() => {
    const validDays = products
      .map(p => getDaysRemaining(p, topProducts))
      .filter((d): d is number => d !== null && d > 0 && d < 3650);
    return validDays.length > 0
      ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
      : null;
  }, [products, topProducts]);

  const previousRevenue = useMemo(() => {
    if (totalRevenue === 0) return 0;
    if (revenueChange === 0) return totalRevenue;
    return Math.round((totalRevenue / (1 + revenueChange / 100)) * 100) / 100;
  }, [totalRevenue, revenueChange]);

  const skuHealth = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let healthy = 0;
    for (const product of products) {
      for (const variant of product.variants) {
        const s = variant.stocks?.[0]?.stockCount ?? 0;
        if (s === 0) critical++;
        else if (s <= maxThreshold) warning++;
        else healthy++;
      }
    }
    const total = critical + warning + healthy;
    const denominator = total || 1;
    return {
      total,
      critical,
      warning,
      healthy,
      segments: {
        healthy: (healthy / denominator) * 100,
        warning: (warning / denominator) * 100,
        critical: (critical / denominator) * 100,
      },
    };
  }, [products, maxThreshold]);

  const topSellerItems: ProductListItem[] = useMemo(
    () => topSellers.map((s, i) => ({
      productId: s.key,
      index: i + 1,
      image: s.imageUrl,
      name: s.productName,
      meta: s.variantName ? `${s.variantName} • ${s.quantity} adet satıldı` : `${s.quantity} adet satıldı`,
    })),
    [topSellers],
  );

  const lowStockListItems: ProductListItem[] = useMemo(
    () => lowStockProducts.slice(0, 10).map((p, i) => {
      const stock = minStock(p);
      return {
        productId: p.id,
        index: i + 1,
        image: getProductThumbnail(p),
        name: p.name,
        meta: `${p.variants.length} varyant • ${getTotalStock(p)} adet`,
        status: {
          text: stock === 0 ? 'Tükendi' : 'Az Kalan',
          className: stock === 0
            ? 'bg-[#fef2f2] text-[#b30000] text-xs px-2 py-0.5 rounded-full'
            : 'bg-[#fffbeb] text-[#92400e] text-xs px-2 py-0.5 rounded-full',
        },
      };
    }),
    [lowStockProducts],
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-[14px] text-[#75758a]">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* SECTION 1 — KPI Metrikleri */}
      <section className="mb-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {/* 1 — 30 Günlük Ciro */}
          <div className="p-6 border-b border-r border-[#e5e7eb] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#75758a] mb-1">30 GÜNLÜK CİRO</p>
            <p className="text-sm text-[#75758a] mb-3">Toplam gelir</p>
            <p className="text-4xl font-normal tracking-[-0.03em] text-[#17171c] mb-3">{formatPrice(totalRevenue)}</p>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium w-fit mb-2 ${
                isPositive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef2f2] text-[#991b1b]'
              }`}
            >
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}
              {revenueChange}%
            </span>
            <p className="text-xs text-[#75758a]">Geçen ay: {formatPrice(previousRevenue)}</p>
          </div>

          {/* 2 — Aktif Ürün */}
          <div className="p-6 border-b border-r border-[#e5e7eb] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#75758a] mb-1">AKTİF ÜRÜN</p>
            <p className="text-sm text-[#75758a] mb-3">Aktif katalog</p>
            <p className="text-4xl font-normal tracking-[-0.03em] text-[#17171c] mb-3">{products.length}</p>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit mb-2 bg-[#f3f4f6] text-[#374151]">
              {skuHealth.total} SKU
            </span>
            <p className="text-xs text-[#75758a]">Varyant bazlı takip</p>
          </div>

          {/* 3 — Kritik Stok (tıklanabilir) */}
          <Link
            href="/dashboard/stok?filter=tukendi"
            className="p-6 border-b border-r border-[#e5e7eb] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0 block transition-colors hover:bg-[#f8f9fa] cursor-pointer"
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#75758a] mb-1">KRİTİK STOK</p>
            <p className="text-sm text-[#75758a] mb-3">Müdahale gerekli</p>
            <p className="text-4xl font-normal tracking-[-0.03em] text-[#b30000] mb-3">{criticalCount + warningCount}</p>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit mb-2 bg-[#fef2f2] text-[#991b1b]">
              {criticalCount} tükendi
            </span>
            <p className="text-xs text-[#75758a]">{warningCount} ürün eşik altında</p>
          </Link>

          {/* 4 — Ölü Stok (tıklanabilir) */}
          <Link
            href="/dashboard/stok?view=dead"
            className="p-6 border-b border-r border-[#e5e7eb] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0 block transition-colors hover:bg-[#f8f9fa] cursor-pointer"
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#75758a] mb-1">ÖLÜ STOK</p>
            <p className="text-sm text-[#75758a] mb-3">Bağlı sermaye</p>
            <p className="text-4xl font-normal tracking-[-0.03em] text-[#4338ca] mb-3">{deadStockCount}</p>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit mb-2 bg-[#eef2ff] text-[#4338ca]">
              {formatPrice(lockedCapital)}
            </span>
            <p className="text-xs text-[#75758a]">180+ gündür satılmıyor</p>
          </Link>

          {/* 5 — Ortalama Stok Ömrü */}
          <div className="p-6 border-b border-r border-[#e5e7eb] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#75758a] mb-1">ORT. STOK ÖMRÜ</p>
            <p className="text-sm text-[#75758a] mb-3">Tahmini ömür</p>
            <p className="text-4xl font-normal tracking-[-0.03em] text-[#17171c] mb-3">
              {avgDaysRemaining !== null ? `${avgDaysRemaining} gün` : '—'}
            </p>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium w-fit mb-2 bg-[#e0f2fe] text-[#0369a1]">
              Satış hızına göre
            </span>
            <p className="text-xs text-[#75758a]">
              {avgDaysRemaining !== null ? 'Mevcut satış hızıyla hesaplandı' : 'Yeterli satış verisi yok'}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Stok Sağlığı */}
      <section className="mb-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[#17171c]">Stok Sağlığı</h2>
            <p className="mt-0.5 text-xs text-[#75758a]">
              Toplam {skuHealth.total} SKU&apos;nun stok durumu dağılımı
            </p>
          </div>
          <Link
            href="/dashboard/stok"
            className="text-[#9ca3af] hover:text-[#17171c] transition-colors"
            aria-label="Stok listesini görüntüle"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>

        <div
          className="flex h-3 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Sağlıklı ${skuHealth.healthy}, Az kalan ${skuHealth.warning}, Tükendi ${skuHealth.critical}`}
        >
          {skuHealth.healthy > 0 && (
            <div className="bg-[#10b981]" style={{ width: `${skuHealth.segments.healthy}%` }} />
          )}
          {skuHealth.warning > 0 && (
            <div className="bg-[#f59e0b]" style={{ width: `${skuHealth.segments.warning}%` }} />
          )}
          {skuHealth.critical > 0 && (
            <div className="bg-[#ef4444]" style={{ width: `${skuHealth.segments.critical}%` }} />
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          {[
            { dot: '#10b981', label: 'Sağlıklı', count: skuHealth.healthy },
            { dot: '#f59e0b', label: 'Az Kalan', count: skuHealth.warning },
            { dot: '#ef4444', label: 'Tükendi', count: skuHealth.critical },
          ].map(item => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.dot }} />
                <span className="text-xs text-[#75758a]">{item.label}</span>
              </div>
              <p>
                <span className="text-2xl font-semibold tracking-tight text-[#17171c]">{item.count}</span>
                <span className="ml-1 text-xs text-[#75758a]">SKU</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — Performans Trendi */}
      <div className="mb-4">
        <TrendChart
          title="Performans Trendi"
          subtitle="Ciro, satış ve görüntülenme hareketleri"
          data={dashboardTrendData}
          metrics={['revenue', 'quantity', 'views']}
          defaultMetric="revenue"
          defaultPeriod="daily"
          height={280}
          emptyMessage="Henüz yeterli veri yok"
        />
      </div>

      {/* SECTIONS 4 & 5 — En Çok Satanlar + Az Kalan Ürünler (side by side) */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductListCard
          title="En Çok Satanlar"
          subtitle="Son 30 gün"
          items={topSellerItems}
          emptyState={{
            icon: BarChart2,
            title: 'Henüz satış verisi yok',
            description: 'Satış gerçekleşince burada görünecek.',
          }}
        />
        <ProductListCard
          title="Az Kalan Ürünler"
          subtitle={`Stok eşiği (${maxThreshold} adet) altına düşen ve tükenen ürünler`}
          badge={lowStockProducts.length > 0 ? {
            text: `${lowStockProducts.length} ürün`,
            className: 'shrink-0 rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-xs font-medium text-[#b30000]',
          } : undefined}
          items={lowStockListItems}
          emptyState={{
            icon: CheckCircle,
            title: 'Tüm ürünler sağlıklı',
            description: 'Stok eşiği altında ürün bulunmuyor.',
          }}
        />
      </div>
    </div>
  );
}
