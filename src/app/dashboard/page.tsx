'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  BarChart2,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
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

function formatStockAge(days: number): { primary: string; secondary: string } {
  const years = days / 365;
  if (years >= 1) {
    return {
      primary: `${years.toFixed(1).replace('.', ',')} yıl`,
      secondary: `${days.toLocaleString('tr-TR')} gün ortalama`,
    };
  }
  return {
    primary: `${days} gün`,
    secondary: `${days} gün ortalama`,
  };
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
      <section className="mb-4 rounded-xl border border-[#E4E7EC] bg-[#ffffff] overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {/* 1 — Son 30 Gün Ciro */}
          <div className="flex flex-col p-5 border-b border-r border-[#E4E7EC] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-[#667085]" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#667085]">SON 30 GÜN CİRO</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">{formatPrice(totalRevenue)}</p>
            <div className="mt-auto pt-3">
              {revenueChange === 0 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f3f4f6] text-[#667085]">
                  %0
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isPositive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef2f2] text-[#991b1b]'
                  }`}
                >
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isPositive ? '+' : ''}
                  {revenueChange}%
                </span>
              )}
              <p className="text-xs text-[#667085] mt-1.5">
                {revenueChange === 0 ? 'Geçen döneme göre değişmedi' : `Geçen ay: ${formatPrice(previousRevenue)}`}
              </p>
            </div>
          </div>

          {/* 2 — Aktif Ürün */}
          <div className="flex flex-col p-5 border-b border-r border-[#E4E7EC] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3 w-3 text-[#667085]" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#667085]">AKTİF ÜRÜN</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">{products.length} ürün</p>
            <div className="mt-auto pt-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f3f4f6] text-[#667085]">
                {skuHealth.total} SKU
              </span>
              <p className="text-xs text-[#667085] mt-1.5">Varyant bazlı takip</p>
            </div>
          </div>

          {/* 3 — Kritik Stok (tıklanabilir) */}
          <Link
            href="/dashboard/stok?filter=tukendi"
            className="group flex flex-col p-5 border-b border-r border-[#E4E7EC] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0 cursor-pointer transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm hover:border-[#d0d5dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-[#667085]" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#667085]">KRİTİK STOK</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">{criticalCount + warningCount} ürün</p>
            <div className="mt-auto pt-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#fef2f2] text-[#b30000]">
                    {criticalCount} tükendi
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#fffbeb] text-[#92400e]">
                    {warningCount} eşik altında
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#667085] group-hover:text-[#101828] transition-colors">
                Ürünleri görüntüle
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
              </span>
            </div>
          </Link>

          {/* 4 — Ölü Stok (tıklanabilir) */}
          <Link
            href="/dashboard/stok?view=dead"
            className="group flex flex-col p-5 border-b border-r border-[#E4E7EC] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0 cursor-pointer transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm hover:border-[#d0d5dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Archive className="h-3 w-3 text-[#667085]" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#667085]">ÖLÜ STOK</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">{formatPrice(lockedCapital)}</p>
            <div className="mt-auto pt-3">
              <p className="text-xs text-[#667085] mb-2">{deadStockCount} ürün · 180+ gündür satılmıyor</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#667085] group-hover:text-[#101828] transition-colors">
                Ölü stokları görüntüle
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
              </span>
            </div>
          </Link>

          {/* 5 — Ortalama Stok Ömrü */}
          <div className="flex flex-col p-5 border-b border-r border-[#E4E7EC] even:border-r-0 last:border-b-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-[#667085]" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#667085]">ORT. STOK ÖMRÜ</p>
            </div>
            {avgDaysRemaining !== null ? (() => {
              const age = formatStockAge(avgDaysRemaining);
              return (
                <>
                  <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">{age.primary}</p>
                  <div className="mt-auto pt-3">
                    <p className="text-xs text-[#667085]">{age.secondary}</p>
                    <p className="text-xs text-[#667085] mt-0.5">Satış hızına göre hesaplandı</p>
                  </div>
                </>
              );
            })() : (
              <>
                <p className="text-3xl font-semibold tracking-tight text-[#101828] mt-2">—</p>
                <div className="mt-auto pt-3">
                  <p className="text-xs text-[#667085]">Yeterli satış verisi yok</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2 — Stok Sağlığı */}
      <section className="mb-4 rounded-xl border border-[#E4E7EC] bg-[#ffffff] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[#101828]">Stok Sağlığı</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              Toplam {skuHealth.total} SKU&apos;nun stok durumu dağılımı
            </p>
          </div>
          <Link
            href="/dashboard/stok"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#667085] hover:text-[#101828] transition-colors"
          >
            Tüm stokları görüntüle
            <span>&rarr;</span>
          </Link>
        </div>

        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full"
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

        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { dot: '#10b981', label: 'Sağlıklı', count: skuHealth.healthy, pct: skuHealth.segments.healthy },
            { dot: '#f59e0b', label: 'Az Kalan', count: skuHealth.warning, pct: skuHealth.segments.warning },
            { dot: '#ef4444', label: 'Tükendi', count: skuHealth.critical, pct: skuHealth.segments.critical },
          ].map(item => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.dot }} />
                <span className="text-xs text-[#667085]">{item.label}</span>
              </div>
              <p>
                <span className="text-xl font-semibold tracking-tight text-[#101828]">{item.count}</span>
                <span className="ml-1 text-xs text-[#667085]">SKU</span>
              </p>
              <p className="text-xs text-[#667085]">
                %{item.pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
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
