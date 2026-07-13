'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  ArrowUpRight,
  BarChart2,
  CheckCircle,
  Clock,
  Eye,
  Package,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { ListProductsApiResponse } from '../api/ikas/list-products/route';
import { AnalyticsApiResponse } from '../api/ikas/analytics/route';
import { useStockThreshold } from '@/lib/stock-threshold';
import { getTotalStock, getDaysRemaining } from '@/components/home-page/lib/product';

type Product = NonNullable<ListProductsApiResponse['products']>[0];
type Variant = Product['variants'][number];
type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type Metric = 'revenue' | 'stock';

const TR_MONTHS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
] as const;

const TREND_PERIOD_OPTIONS: ReadonlyArray<{ value: TrendPeriod; short: string; label: string }> = [
  { value: 'daily', short: 'G', label: 'Günlük' },
  { value: 'weekly', short: 'H', label: 'Haftalık' },
  { value: 'monthly', short: 'A', label: 'Aylık' },
  { value: 'yearly', short: 'Y', label: 'Yıllık' },
];

const METRIC_OPTIONS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: 'revenue', label: 'Ciro' },
  { value: 'stock', label: 'Stok' },
];

// Cohere semantic tokens: primary for ciro, action-blue for stok.
const TREND_CHART_CONFIG = {
  revenue: { label: 'Ciro', color: '#17171c' },
  stock: { label: 'Stok', color: '#1863dc' },
} satisfies ChartConfig;

function formatPrice(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

function formatTrendCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDayLabel(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${TR_MONTHS_SHORT[date.getMonth()]}`;
}

interface TrendPoint {
  label: string;
  revenue: number;
  stock: number;
}

/**
 * Gerçek günlük ciro verisini seçili döneme göre gruplar.
 * Ciro toplanır; stok, dönem sonu anlık değeri (mevcut stok-trend mantığı) olarak alınır.
 */
function buildTrendData(
  daily: ReadonlyArray<{ date: string; revenue: number }>,
  totalStock: number,
  period: TrendPeriod,
): TrendPoint[] {
  const base = daily
    .map((d, index) => ({
      date: new Date(d.date),
      revenue: d.revenue,
      stock: Math.max(0, totalStock - index * 2),
    }))
    .filter(p => !Number.isNaN(p.date.getTime()));

  if (period === 'daily') {
    return base.map(p => ({ label: formatDayLabel(p.date), revenue: p.revenue, stock: p.stock }));
  }

  const buckets = new Map<string, TrendPoint>();
  for (const p of base) {
    let key: string;
    let label: string;
    if (period === 'weekly') {
      const weekday = (p.date.getDay() + 6) % 7; // Pazartesi = 0
      const start = new Date(p.date);
      start.setDate(p.date.getDate() - weekday);
      key = start.toISOString().slice(0, 10);
      label = formatDayLabel(start);
    } else if (period === 'monthly') {
      key = `${p.date.getFullYear()}-${p.date.getMonth()}`;
      label = `${TR_MONTHS_SHORT[p.date.getMonth()]} ${String(p.date.getFullYear()).slice(2)}`;
    } else {
      key = String(p.date.getFullYear());
      label = key;
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += p.revenue;
      existing.stock = p.stock;
    } else {
      buckets.set(key, { label, revenue: p.revenue, stock: p.stock });
    }
  }
  return Array.from(buckets.values());
}

function minStock(product: Product): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map(v => v.stocks?.[0]?.stockCount ?? 0));
}

function getProductThumbnail(product: Product): string | undefined {
  return product.variants.find(v => v.imageUrl)?.imageUrl;
}



const ProductThumb: React.FC<{ product: Product }> = ({ product }) => {
  const [failed, setFailed] = useState(false);
  const url = getProductThumbnail(product);

  if (!url || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f8f9fa]">
        <Package className="h-5 w-5 text-[#d1d5db]" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const Thumbnail: React.FC<{ src?: string; className?: string }> = ({ src, className }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] ${className ?? ''}`}
      >
        <Package className="h-5 w-5 text-[#d1d5db]" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`h-10 w-10 shrink-0 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] object-cover ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  );
};

type StockStatus = 'out' | 'critical' | 'low';

/** Stok durumunu min (kritik) eşiğine göre belirler; 0 tükendi, ≤min kritik, üzeri az kalan. */
function getStockStatus(stock: number, minThreshold: number): StockStatus {
  if (stock === 0) return 'out';
  if (stock <= minThreshold) return 'critical';
  return 'low';
}

const STOCK_STATUS_META: Record<StockStatus, { label: string; className: string; dot: string }> = {
  out: { label: 'Tükendi', className: 'border border-[#fca5a5] bg-[#fef2f2] text-[#b30000]', dot: '#ef4444' },
  critical: { label: 'Kritik', className: 'bg-[#fef2f2] text-[#b30000]', dot: '#ef4444' },
  low: { label: 'Az Kalan', className: 'bg-[#fffbeb] text-[#92400e]', dot: '#f59e0b' },
};

function StockStatusBadge({ status }: { status: StockStatus }) {
  const meta = STOCK_STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export default function DashboardPage() {
  const [, setToken] = useState<string | null>(null);
  const [, setStoreName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily');
  const [metric, setMetric] = useState<Metric>('revenue');

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

  const initialize = useCallback(async () => {
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (fetchedToken) {
        await Promise.all([
          fetchStoreName(fetchedToken),
          fetchProducts(fetchedToken),
          fetchAnalytics(fetchedToken),
        ]);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStoreName, fetchProducts, fetchAnalytics]);

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

  const trendData = useMemo(
    () => buildTrendData(analytics?.dailyRevenue ?? [], totalStock, trendPeriod),
    [analytics, totalStock, trendPeriod],
  );

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const revenueChange = analytics?.revenueChange ?? 0;
  const isPositive = revenueChange >= 0;
  const topProducts = analytics?.topProducts ?? [];

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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-[14px] text-[#75758a]">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* SECTION 1 — KPI Kartları */}
      <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* Kart 1 — 30 Günlük Ciro */}
        <section className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">30 GÜNLÜK CİRO</span>
            <TrendingUp className="h-4 w-4 text-[#75758a]" />
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#17171c]">{formatPrice(totalRevenue)}</p>
          <span
            className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isPositive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef2f2] text-[#991b1b]'
            }`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}
            {revenueChange}%
          </span>
        </section>

        {/* Kart 2 — Aktif Ürün */}
        <section className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">AKTİF ÜRÜN</span>
            <Package className="h-4 w-4 text-[#75758a]" />
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#17171c]">{products.length}</p>
          <p className="mt-3 text-xs text-[#75758a]">{skuHealth.total} SKU · varyant bazlı</p>
        </section>

        {/* Kart 3 — Kritik Stok (tıklanabilir) */}
        <Link
          href="/dashboard/stok?filter=tukendi"
          className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5 transition-colors hover:bg-[#f8f9fa] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">KRİTİK STOK</span>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-[#b30000]" />
              <ArrowUpRight className="h-3.5 w-3.5 text-[#d1d5db]" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#b30000]">{criticalCount + warningCount}</p>
          <div className="mt-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-[#75758a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b30000]" />
              <span>{criticalCount} ürün tükendi</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#75758a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
              <span>{warningCount} ürün eşik altında</span>
            </div>
          </div>
        </Link>

        {/* Kart 4 — Ölü Stok (tıklanabilir) */}
        <Link
          href="/dashboard/stok?view=dead"
          className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5 transition-colors hover:bg-[#f8f9fa] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">ÖLÜ STOK</span>
            <div className="flex items-center gap-1">
              <Archive className="h-4 w-4 text-[#4338ca]" />
              <ArrowUpRight className="h-3.5 w-3.5 text-[#d1d5db]" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#4338ca]">{deadStockCount}</p>
          <div className="mt-3 flex flex-col gap-0.5">
            <p className="text-xs font-medium text-[#4338ca]">{formatPrice(lockedCapital)}</p>
            <p className="text-[11px] text-[#75758a]">bağlı sermaye · 180+ gün</p>
          </div>
        </Link>

        {/* Kart 5 — Ortalama Stok Ömrü */}
        <section className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">ORT. STOK ÖMRÜ</span>
            <Clock className="h-4 w-4 text-[#75758a]" />
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#17171c]">
            {avgDaysRemaining !== null ? `${avgDaysRemaining} gün` : '—'}
          </p>
          <p className="mt-3 text-xs text-[#75758a]">
            {avgDaysRemaining !== null ? 'satış hızına göre tahmini' : 'yeterli satış verisi yok'}
          </p>
        </section>
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

      {/* SECTION 3 — Stok Trendi (tam genişlik) */}
      <section className="mb-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-[#17171c]">Stok Trendi</h2>
            <p className="mt-0.5 text-[12px] text-[#75758a]">Ciro ve stok hareketleri</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Dönem segmented control (G/H/A/Y) */}
            <div
              role="group"
              aria-label="Dönem seçimi"
              className="grid grid-cols-4 gap-0.5 rounded-full bg-[#f3f4f6] p-0.5"
            >
              {TREND_PERIOD_OPTIONS.map(o => {
                const active = trendPeriod === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-label={o.label}
                    title={o.label}
                    aria-pressed={active}
                    onClick={() => setTrendPeriod(o.value)}
                    className={`w-9 rounded-full py-1 text-center text-[12px] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-1 ${
                      active
                        ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                        : 'text-[#75758a] hover:text-[#17171c]'
                    }`}
                  >
                    {o.short}
                  </button>
                );
              })}
            </div>

            {/* Metrik segmented control (Ciro/Stok) */}
            <div
              role="group"
              aria-label="Metrik seçimi"
              className="inline-flex gap-0.5 rounded-full bg-[#f3f4f6] p-0.5"
            >
              {METRIC_OPTIONS.map(o => {
                const active = metric === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-label={o.label}
                    title={o.label}
                    aria-pressed={active}
                    onClick={() => setMetric(o.value)}
                    className={`rounded-full px-3 py-1 text-[12px] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c6ee6] focus-visible:ring-offset-1 ${
                      active
                        ? 'bg-[#ffffff] font-medium text-[#17171c] shadow-sm'
                        : 'text-[#75758a] hover:text-[#17171c]'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {!analytics ? (
            <div className="flex h-[260px] items-center justify-center text-center">
              <p className="text-[13px] text-[#75758a]">
                Trend verileri yüklenirken bir hata oluştu.
              </p>
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-center">
              <p className="text-[13px] text-[#75758a]">
                Seçili dönem için trend verisi bulunamadı.
              </p>
            </div>
          ) : (
            <ChartContainer
              config={TREND_CHART_CONFIG}
              className="aspect-auto h-[260px] w-full"
            >
              <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      className="rounded-lg shadow-sm"
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="h-2 w-2 rounded-[2px]"
                              style={{ backgroundColor: `var(--color-${name})` }}
                            />
                            {TREND_CHART_CONFIG[name as Metric]?.label ?? name}
                          </span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {metric === 'revenue'
                              ? formatTrendCurrency(Number(value))
                              : `${Number(value).toLocaleString('tr-TR')} adet`}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey={metric}
                  type="monotone"
                  stroke={`var(--color-${metric})`}
                  strokeWidth={2}
                  fill={`var(--color-${metric})`}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </section>

      {/* SECTION 4 — En Çok Satanlar */}
      <section className="mb-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-[#17171c]">En Çok Satanlar</h2>
          <p className="text-[12px] text-[#75758a]">Son 30 gün</p>
        </div>

        {topSellers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10">
            <BarChart2 className="mb-3 h-8 w-8 text-[#75758a]" />
            <p className="text-[14px] font-medium text-[#17171c]">Henüz satış verisi yok</p>
            <p className="mt-1 text-[12px] text-[#75758a]">
              Satış gerçekleşince burada görünecek.
            </p>
          </div>
        ) : (
          <div className="mt-3 min-h-0 overflow-y-auto [scrollbar-color:#e5e7eb_transparent] [scrollbar-width:thin] max-lg:max-h-[360px]">
            {topSellers.map((s, i) => (
              <div
                key={s.key}
                className="flex items-center gap-3 border-b border-[#f3f4f6] py-2.5 last:border-0"
              >
                <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-[#93939f]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Thumbnail src={s.imageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[#17171c]">
                    {s.productName}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#75758a]">
                    {s.variantName ? `${s.variantName} • ` : ''}
                    {s.quantity} adet satıldı
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-semibold text-[#17171c]">
                  {formatPrice(s.revenue)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 5 — Az Kalan Ürünler (tablo) */}
      <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-medium text-[#17171c]">Az Kalan Ürünler</h2>
            <p className="mt-0.5 text-[12px] text-[#75758a]">
              Stok eşiği ({maxThreshold} adet) altına düşen ve tükenen ürünler
            </p>
          </div>
          {lowStockProducts.length > 0 && (
            <span className="shrink-0 rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-[12px] font-medium text-[#b30000]">
              {lowStockProducts.length} ürün
            </span>
          )}
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle className="mb-3 h-8 w-8 text-[#003c33]" />
            <p className="text-[14px] font-medium text-[#17171c]">Tüm ürünler sağlıklı</p>
            <p className="mt-1 text-[12px] text-[#75758a]">Stok eşiği altında ürün bulunmuyor.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[#f3f4f6] hover:bg-transparent">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  Ürün
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  Varyant
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  Mevcut Stok
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  Eşik
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  Durum
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[#75758a]">
                  İşlem
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockProducts.map(p => {
                const stock = minStock(p);
                const status = getStockStatus(stock, minThreshold);
                return (
                  <TableRow key={p.id} className="border-[#f3f4f6] hover:bg-[#f8f9fa]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductThumb product={p} />
                        <span className="max-w-[240px] truncate text-[14px] font-medium text-[#17171c]">
                          {p.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-[#75758a]">
                      {p.variants.length} varyant
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-[14px] font-medium tabular-nums text-[#17171c]">
                        {stock}
                      </span>
                      <span className="ml-1 text-[12px] text-[#75758a]">adet</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] tabular-nums text-[#75758a]">
                      {maxThreshold}
                    </TableCell>
                    <TableCell>
                      <StockStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href="/dashboard/stok"
                        className="text-[#9ca3af] hover:text-[#17171c] transition-colors"
                        aria-label="Görüntüle"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
