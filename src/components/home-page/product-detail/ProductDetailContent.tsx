'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import type { SingleProductViewStats } from '@/app/api/product-view/stats/route';
import { ApiRequests } from '@/lib/api-requests';
import type { DaySeriesPoint, Product } from '../types';
import { STATUS_SEVERITY } from '../constants';
import {
  getProductCategory,
  getProductStatus,
  getProductThumbnail,
  getTotalStock,
  getVariantName,
  getVariantStock,
  stockToStatus,
} from '../lib/product';
import {
  getProductQuantity,
  getProductRevenue,
  getVariantQuantity,
  getVariantRevenue,
} from '../lib/analytics';
import { formatPrice } from '../lib/format';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { ModalProductImage } from './atoms';
import { VariantCard } from './VariantCard';
import { TrendChart, type TrendDataPoint } from '@/components/shared/TrendChart';

export const ProductDetailContent: React.FC<{
  product: Product;
  analytics: AnalyticsApiResponse | null;
  token: string | null;
  viewStats?: Record<string, number> | null;
  criticalThreshold?: number;
  warningThreshold?: number;
  portalContainer?: HTMLElement | null;
}> = ({ product, analytics, token, criticalThreshold = 5, warningThreshold = 10, portalContainer }) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all');
  const [viewDetail, setViewDetail] = useState<SingleProductViewStats | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const variants = product.variants;
  const totalStock = getTotalStock(product);
  const overallStatus = getProductStatus(product, criticalThreshold, warningThreshold);
  const category = getProductCategory(product);
  const productImage = getProductThumbnail(product);

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const dailyRevenue = analytics?.dailyRevenue ?? [];
  const topProducts = useMemo(() => analytics?.topProducts ?? [], [analytics]);
  const sumDaily = useMemo(() => dailyRevenue.reduce((s, d) => s + d.revenue, 0), [dailyRevenue]);

  const productRevenue = useMemo(() => getProductRevenue(product, topProducts), [product, topProducts]);
  const productQuantity = useMemo(() => getProductQuantity(product, topProducts), [product, topProducts]);

  const selectedVariant =
    selectedVariantId === 'all' ? null : variants.find(v => v.id === selectedVariantId) ?? null;

  const targetRevenue = selectedVariant ? getVariantRevenue(selectedVariant.id, topProducts) : productRevenue;
  const soldCount = selectedVariant ? getVariantQuantity(selectedVariant.id, topProducts) : productQuantity;
  const share = totalRevenue > 0 ? targetRevenue / totalRevenue : 0;

  useEffect(() => {
    if (!token) return;
    setViewLoading(true);
    setViewDetail(null);
    ApiRequests.productView.getViewStats(token, product.id)
      .then(res => {
        if (res.status === 200 && res.data?.data && 'totalViews' in res.data.data) {
          setViewDetail(res.data.data as SingleProductViewStats);
        }
      })
      .catch(() => setViewDetail(null))
      .finally(() => setViewLoading(false));
  }, [token, product.id]);

  const viewMap = useMemo(() => {
    const map = new Map<string, number>();
    if (viewDetail) {
      for (const d of viewDetail.dailyViews) {
        map.set(d.date, d.viewCount);
      }
    }
    return map;
  }, [viewDetail]);

  const dailySeries = useMemo<DaySeriesPoint[]>(
    () =>
      dailyRevenue.map(d => ({
        date: d.date,
        revenue: Math.round(d.revenue * share * 100) / 100,
        units: sumDaily > 0 ? soldCount * (d.revenue / sumDaily) : 0,
        views: viewMap.get(d.date) ?? 0,
      })),
    [dailyRevenue, share, soldCount, sumDaily, viewMap],
  );

  const productTrendData: TrendDataPoint[] = useMemo(
    () => dailySeries.map(d => ({
      date: d.date,
      revenue: d.revenue,
      quantity: Math.round(d.units),
      views: d.views,
    })),
    [dailySeries],
  );
  const variantsSorted = useMemo(
    () =>
      [...variants].sort((a, b) => {
        const sa = STATUS_SEVERITY[stockToStatus(getVariantStock(a), criticalThreshold, warningThreshold)];
        const sb = STATUS_SEVERITY[stockToStatus(getVariantStock(b), criticalThreshold, warningThreshold)];
        return sa - sb || getVariantStock(a) - getVariantStock(b);
      }),
    [variants, criticalThreshold, warningThreshold],
  );

  const fetchHourly = useCallback(async (date: string) => {
    if (!token) return [];
    const res = await ApiRequests.ikas.getHourlyAnalytics(token, date);
    return res.data?.data?.hourlyData ?? [];
  }, [token]);

  const fetchHourlyViews = useCallback(async (date: string) => {
    if (!token) return [];
    const res = await ApiRequests.productView.getHourlyViewStats(token, date);
    return res.data?.data?.hourlyViews ?? [];
  }, [token]);

  const handleVariantKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = e.currentTarget;
    const radios = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    if (radios.length === 0) return;

    const currentIndex = Array.from(radios).findIndex(b => b.getAttribute('aria-checked') === 'true');
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % radios.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + radios.length) % radios.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = radios.length - 1;
        break;
      default:
        return;
    }

    const target = radios[nextIndex];
    if (target) {
      target.focus();
      target.click();
      target.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col max-sm:max-h-full">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-4 pr-14">
        <ModalProductImage src={productImage} alt={product.name} />
        <div className="min-w-0 flex-1">
          <DialogTitle className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
            {product.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {product.name} ürününün varyant ve satış detayları
          </DialogDescription>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {category && (
              <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                {category}
              </span>
            )}
            <span>{variants.length} varyant</span>
            <span>{totalStock} adet stok</span>
          </div>
        </div>
        <StatusBadge status={overallStatus} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
        <div className="md:grid md:h-full md:min-h-0 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="md:flex md:flex-col md:min-h-0 md:overflow-hidden md:border-r md:border-border">
            <div
              role="radiogroup"
              aria-label="Varyant seçimi"
              onKeyDown={handleVariantKeyDown}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="shrink-0">
                <VariantCard
                  label="Tüm Varyantlar"
                  secondaryText={`${variants.length} varyant · ${totalStock} adet toplam stok`}
                  status={overallStatus}
                  selected={selectedVariantId === 'all'}
                  tabIndex={selectedVariantId === 'all' ? 0 : -1}
                  onClick={() => setSelectedVariantId('all')}
                  hideBadge
                />
              </div>
              
              <div className="shrink-0">
                <p className="px-4 py-2 mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  VARYANTLAR
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
                {variantsSorted.map(v => {
                  const stock = getVariantStock(v);
                  const price = v.prices?.[0]?.sellPrice ?? 0;
                  const variantStatus = stockToStatus(stock, criticalThreshold, warningThreshold);
                  const hideBadge = variantStatus === overallStatus;
                  
                  const stockText = stock === 0 ? 'Stok yok' : `${stock} adet`;
                  const priceText = price > 0 ? formatPrice(price) : '—';

                  return (
                    <VariantCard
                      key={v.id}
                      label={getVariantName(v)}
                      secondaryText={`${stockText} · ${priceText}`}
                      status={variantStatus}
                      selected={selectedVariantId === v.id}
                      tabIndex={selectedVariantId === v.id ? 0 : -1}
                      onClick={() => setSelectedVariantId(v.id)}
                      hideBadge={hideBadge}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="min-w-0 p-4 flex flex-col min-h-0">
            <TrendChart
              title="Satış Grafiği"
              subtitle={selectedVariant ? getVariantName(selectedVariant) : 'Tüm Varyantlar'}
              data={productTrendData}
              metrics={!selectedVariantId || selectedVariantId === 'all' ? ['revenue', 'quantity', 'views'] : ['revenue', 'quantity']}
              defaultMetric="revenue"
              defaultPeriod="last30d"
              height={240}
              hourlyFetch={fetchHourly}
              hourlyViewFetch={fetchHourlyViews}
              layout="modal"
              portalContainer={portalContainer}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
