'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  BarChart2,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
} from 'lucide-react';
import { ApiRequests } from '@/lib/api-requests';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useStockThreshold } from '@/lib/stock-threshold';
import { formatPrice, useMerchantCurrency } from '@/lib/currency';
import { getTotalStock } from '@/lib/products/product';
import { ProductListCard, type ProductListItem } from './_components/ProductListCard';
import { ConversionInsightCard } from './_components/ConversionInsightCard';
import { KpiTile } from './_components/KpiTile';
import { TrendChart, type TrendDataPoint } from '@/components/shared/TrendChart';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { TrendBadge } from '@/components/shared/badges/TrendBadge';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/data-table/EmptyState';
import { DashboardSkeleton } from './_components/DashboardSkeleton';
import { useDashboardData } from './hooks/use-dashboard-data';
import {
  buildDashboardTrendData,
  buildVariantIndex,
  computeAvgDaysRemaining,
  computeDeadStock,
  computeLockedCapital,
  computeLowStockProducts,
  computePreviousRevenue,
  computeSkuHealth,
  computeTopSellers,
  countCritical,
  countWarning,
  formatStockAge,
  minStock,
} from './lib/metrics';
import { getProductThumbnail } from '@/lib/products/product';

export default function DashboardPage() {
  const {
    token,
    products,
    analytics,
    dailyViewStats,
    conversionInsight,
    isMockData,
    loading,
    error,
    sectionErrors,
    reload,
  } = useDashboardData();

  const { threshold, hydrated: thresholdHydrated } = useStockThreshold();
  const { max: maxThreshold } = threshold;

  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();

  const salesByVariant = useMemo(() => analytics?.salesByVariant ?? [], [analytics]);

  // ── Metrikler (saf fonksiyonlar ./lib/metrics.ts içinde) ──
  const criticalCount = useMemo(() => countCritical(products), [products]);
  const warningCount = useMemo(() => countWarning(products, maxThreshold), [products, maxThreshold]);
  const lowStockProducts = useMemo(
    () => computeLowStockProducts(products, maxThreshold),
    [products, maxThreshold],
  );
  const skuHealth = useMemo(() => computeSkuHealth(products, maxThreshold), [products, maxThreshold]);
  const deadStock = useMemo(() => computeDeadStock(products, salesByVariant), [products, salesByVariant]);
  const lockedCapital = useMemo(() => computeLockedCapital(deadStock), [deadStock]);
  const variantIndex = useMemo(() => buildVariantIndex(products), [products]);
  const topSellers = useMemo(
    () => computeTopSellers(salesByVariant, variantIndex),
    [salesByVariant, variantIndex],
  );
  const avgDaysRemaining = useMemo(
    () => computeAvgDaysRemaining(products, salesByVariant),
    [products, salesByVariant],
  );

  // Ölü stok / stok ömrü hem ürün hem satış verisine bağlı: satışlar gelmezse
  // tüm ürünler "180+ gündür satılmıyor" gibi görünür — yanıltıcı, degrade et.
  const deadStockUnavailable = sectionErrors.products || sectionErrors.analytics;

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const revenueChange = analytics?.revenueChange ?? 0;
  const previousRevenue = useMemo(
    () => computePreviousRevenue(totalRevenue, revenueChange),
    [totalRevenue, revenueChange],
  );

  const dailyViewMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dailyViewStats?.dailyViews ?? []) map.set(d.date, d.viewCount);
    return map;
  }, [dailyViewStats]);

  const dashboardTrendData: TrendDataPoint[] = useMemo(
    () => buildDashboardTrendData(analytics, dailyViewMap),
    [analytics, dailyViewMap],
  );

  // ── Saatlik chart veri kaynakları ──
  const fetchHourly = useCallback(
    async (date: string) => {
      if (!token) return [];
      const res = await ApiRequests.ikas.getHourlyAnalytics(token, date);
      return res.data?.data?.hourlyData ?? [];
    },
    [token],
  );

  const fetchHourlyViews = useCallback(
    async (date: string) => {
      if (!token) return [];
      const res = await ApiRequests.productView.getHourlyViewStats(token, date);
      return res.data?.data?.hourlyViews ?? [];
    },
    [token],
  );

  // ── Liste görünümleri ──
  const topSellerItems: ProductListItem[] = useMemo(
    () =>
      topSellers.map((s, i) => ({
        productId: s.key,
        index: i + 1,
        image: s.imageUrl,
        name: s.productName,
        meta: s.variantName || undefined,
        value: s.quantity,
      })),
    [topSellers],
  );

  const lowStockListItems: ProductListItem[] = useMemo(
    () =>
      lowStockProducts.slice(0, 10).map((p, i) => {
        const stock = minStock(p);
        return {
          productId: p.id,
          index: i + 1,
          image: getProductThumbnail(p),
          name: p.name,
          meta: `${p.variants.length} varyant`,
          status: stock === 0 ? 'out' : 'warning',
          value: getTotalStock(p),
        };
      }),
    [lowStockProducts],
  );

  // Eşik localStorage'dan okunana kadar bekle: varsayılan (5/10) ile boyayıp
  // sonra güncellemek KPI sayılarını göz önünde değiştiriyordu.
  if (loading || !thresholdHydrated) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="ÖZET"
        title="Genel Bakış"
        description="Envanter ve satış performansının özeti"
      />

      <div className="space-y-4">
      {/* Mock veri uyarısı — sadece development'ta, sipariş yokken görünür */}
      {isMockData && (
        <div className="rounded-lg border border-hairline bg-muted px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Demo verisi:</span> Mağazada henüz sipariş
            olmadığı için satış grafikleri sentetik veriyle dolduruldu. Gerçek sipariş geldiğinde
            otomatik olarak kaybolur.
          </p>
        </div>
      )}

      {/* SECTION 1 — KPI Metrikleri */}
      {/*
        Sütun sayısı viewport'a değil kartın kendi genişliğine bağlı: iframe genişliği
        sabit olsa da sidebar 256px yediği için medya sorguları yanlış eşikte tetikleniyor
        ve para birimi değerleri komşu tile'a taşıyordu. Ayraçlar her hücreye sağ/alt
        kenarlık olarak veriliyor; grid'in -mr/-mb px'i son sütun ve satırın fazladan
        çizgisini overflow-hidden ile kırpıyor, böylece sütun sayısı serbestçe değişebilir.
      */}
      <section className="@container rounded-lg border border-hairline bg-card overflow-hidden">
        <div className="-mr-px -mb-px grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-5">
          <KpiTile
            icon={DollarSign}
            label="SON 30 GÜN CİRO"
            value={sectionErrors.analytics ? '—' : formatPrice(totalRevenue)}
            footer={
              sectionErrors.analytics ? (
                <p className="text-xs text-muted-foreground">Satış verisi alınamadı</p>
              ) : (
                <>
                  <TrendBadge value={revenueChange} size="sm" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {revenueChange === 0 ? 'Geçen döneme göre değişmedi' : `Geçen ay: ${formatPrice(previousRevenue)}`}
                  </p>
                </>
              )
            }
          />

          <KpiTile
            icon={Package}
            label="AKTİF ÜRÜN"
            value={sectionErrors.products ? '—' : `${products.length} ürün`}
            footer={
              sectionErrors.products ? (
                <p className="text-xs text-muted-foreground">Ürün verisi alınamadı</p>
              ) : (
                <>
                  <Badge variant="neutral">{skuHealth.total} SKU</Badge>
                  <p className="mt-1.5 text-xs text-muted-foreground">Varyant bazlı takip</p>
                </>
              )
            }
          />

          <KpiTile
            icon={AlertTriangle}
            label="KRİTİK STOK"
            value={sectionErrors.products ? '—' : `${criticalCount + warningCount} ürün`}
            href="/dashboard/stok"
            cta="Ürünleri görüntüle"
            footer={
              sectionErrors.products ? (
                <p className="mb-2 text-xs text-muted-foreground">Ürün verisi alınamadı</p>
              ) : (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {criticalCount > 0 && (
                    <StatusBadge status="out" label={`${criticalCount} tükendi`} size="sm" />
                  )}
                  {warningCount > 0 && (
                    <StatusBadge status="warning" label={`${warningCount} eşik altında`} size="sm" />
                  )}
                </div>
              )
            }
          />

          <KpiTile
            icon={Archive}
            label="ÖLÜ STOK"
            value={deadStockUnavailable ? '—' : formatPrice(lockedCapital.total)}
            valueSuffix={
              !deadStockUnavailable &&
              lockedCapital.isEstimate && (
                <span className="block font-sans text-xs font-normal text-muted-foreground">~tahmini</span>
              )
            }
            href="/dashboard/analiz?action=eritme-adayi"
            cta="Eritme adaylarını görüntüle"
            footer={
              deadStockUnavailable ? (
                <p className="mb-2 text-xs text-muted-foreground">Veri alınamadı</p>
              ) : (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground">{deadStock.length} ürün · 180+ gündür satılmıyor</p>
                  {lockedCapital.isEstimate && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ~tahmini: alış fiyatı eksik ürünlerde satış fiyatı kullanıldı
                    </p>
                  )}
                </div>
              )
            }
          />

          <KpiTile
            icon={Clock}
            label="ORT. STOK ÖMRÜ"
            value={
              deadStockUnavailable || avgDaysRemaining === null ? '—' : formatStockAge(avgDaysRemaining).primary
            }
            footer={
              deadStockUnavailable ? (
                <p className="text-xs text-muted-foreground">Veri alınamadı</p>
              ) : avgDaysRemaining !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">{formatStockAge(avgDaysRemaining).secondary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Satış hızına göre hesaplandı</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Yeterli satış verisi yok</p>
              )
            }
          />
        </div>
      </section>

      {/* SECTION 2 — Stok Sağlığı */}
      <section className="@container rounded-lg border border-hairline bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Stok Sağlığı</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toplam {skuHealth.total} SKU&apos;nun stok durumu dağılımı
            </p>
          </div>
          {!sectionErrors.products && skuHealth.total > 0 && (
            <Link
              href="/dashboard/stok"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Tüm stokları görüntüle
              <span>&rarr;</span>
            </Link>
          )}
        </div>

        {sectionErrors.products ? (
          <EmptyState
            icon={AlertTriangle}
            message="Ürün verisi alınamadı."
            actionLabel="Tekrar dene"
            onAction={reload}
          />
        ) : skuHealth.total === 0 ? (
          <EmptyState icon={Package} message="Henüz ürün bulunmuyor." />
        ) : (
          <>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`Sağlıklı ${skuHealth.healthy}, Az kalan ${skuHealth.warning}, Tükendi ${skuHealth.critical}`}
            >
              {skuHealth.healthy > 0 && (
                <div className="bg-status-healthy" style={{ width: `${skuHealth.segments.healthy}%` }} />
              )}
              {skuHealth.warning > 0 && (
                <div className="bg-status-warning" style={{ width: `${skuHealth.segments.warning}%` }} />
              )}
              {skuHealth.critical > 0 && (
                <div className="bg-status-critical" style={{ width: `${skuHealth.segments.critical}%` }} />
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 @md:grid-cols-3">
              {[
                { dot: 'bg-status-healthy', label: 'Sağlıklı', count: skuHealth.healthy, pct: skuHealth.segments.healthy },
                { dot: 'bg-status-warning', label: 'Az Kalan', count: skuHealth.warning, pct: skuHealth.segments.warning },
                { dot: 'bg-status-critical', label: 'Tükendi', count: skuHealth.critical, pct: skuHealth.segments.critical },
              ].map(item => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${item.dot}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <p>
                    <span className="font-mono text-xl font-medium tabular-nums text-foreground">{item.count}</span>
                    <span className="ml-1 text-xs text-muted-foreground">SKU</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    %{item.pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* SECTION 3 — Performans Trendi */}
      {sectionErrors.analytics ? (
        <section
          aria-label="Performans Trendi"
          className="rounded-lg border border-hairline bg-card p-5"
        >
          <h2 className="text-sm font-medium text-foreground">Performans Trendi</h2>
          <EmptyState
            icon={AlertTriangle}
            message="Satış verisi alınamadı."
            actionLabel="Tekrar dene"
            onAction={reload}
          />
        </section>
      ) : (
        <TrendChart
          title="Performans Trendi"
          subtitle="Ciro, satış ve görüntülenme hareketleri"
          data={dashboardTrendData}
          metrics={['revenue', 'quantity', 'views']}
          defaultMetric="revenue"
          defaultPeriod="last30d"
          height={280}
          hourlyFetch={fetchHourly}
          hourlyViewFetch={fetchHourlyViews}
          emptyHint="Farklı bir tarih aralığı seçebilirsiniz."
        />
      )}

      {/* SECTIONS 4 & 5 — En Çok Satanlar + Az Kalan Ürünler (side by side) */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <ProductListCard
            title="En Çok Satanlar"
            subtitle="Son 30 gün"
            items={sectionErrors.analytics ? [] : topSellerItems}
            valueHeader="Adet"
            emptyState={
              sectionErrors.analytics
                ? {
                    icon: AlertTriangle,
                    message: 'Satış verisi alınamadı.',
                    actionLabel: 'Tekrar dene',
                    onAction: reload,
                  }
                : {
                    icon: BarChart2,
                    message: 'Henüz satış verisi yok',
                    description: 'Satış gerçekleşince burada görünecek.',
                  }
            }
          />
          <ProductListCard
            title="Az Kalan Ürünler"
            subtitle={`Stok eşiği (${maxThreshold} adet) altına düşen ve tükenen ürünler`}
            badge={lowStockProducts.length > 0 ? { label: `${lowStockProducts.length} ürün`, variant: 'critical' } : undefined}
            items={sectionErrors.products ? [] : lowStockListItems}
            valueHeader="Stok"
            statusHeader="Durum"
            totalCount={lowStockProducts.length}
            viewAllHref="/dashboard/stok"
            emptyState={
              sectionErrors.products
                ? {
                    icon: AlertTriangle,
                    message: 'Ürün verisi alınamadı.',
                    actionLabel: 'Tekrar dene',
                    onAction: reload,
                  }
                : {
                    icon: CheckCircle,
                    message: 'Tüm ürünler sağlıklı',
                    description: 'Stok eşiği altında ürün bulunmuyor.',
                  }
            }
          />
        </div>
      </div>

      {/* SECTION 6 — Görüntülenme → Satış Dönüşümü */}
      <ConversionInsightCard
        insight={conversionInsight}
        error={sectionErrors.insight}
        onRetry={reload}
      />
      </div>
    </PageContainer>
  );
}
