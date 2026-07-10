'use client';

import React, { useMemo, useState } from 'react';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
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
import { MonoLabel } from '../components/atoms';
import { ModalProductImage, ModalStatusBadge } from './atoms';
import { TumuCard } from './TumuCard';
import { VariantCard } from './VariantCard';
import { SalesChart } from './SalesChart';

/** Ürün detay modalı içeriği: başlık, varyant kartları, aydınlık satış grafiği. */
export const ProductDetailContent: React.FC<{
  product: Product;
  analytics: AnalyticsApiResponse | null;
  criticalThreshold?: number;
  warningThreshold?: number;
}> = ({ product, analytics, criticalThreshold = 5, warningThreshold = 10 }) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('all');

  const variants = product.variants;
  const totalStock = getTotalStock(product);
  const overallStatus = getProductStatus(product, criticalThreshold, warningThreshold);
  const category = getProductCategory(product);
  const productImage = getProductThumbnail(product);

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const dailyRevenue = analytics?.dailyRevenue ?? [];
  const topProducts = useMemo(() => analytics?.topProducts ?? [], [analytics]);
  const sumDaily = useMemo(() => dailyRevenue.reduce((s, d) => s + d.revenue, 0), [dailyRevenue]);

  // Ürün-seviyesi agregatlar (mağaza toplamı DEĞİL).
  const productRevenue = useMemo(() => getProductRevenue(product, topProducts), [product, topProducts]);
  const productQuantity = useMemo(() => getProductQuantity(product, topProducts), [product, topProducts]);

  const selectedVariant =
    selectedVariantId === 'all' ? null : variants.find(v => v.id === selectedVariantId) ?? null;

  // Grafik kapsamına (Tümü / seçili varyant) göre hedef ciro, adet ve pay.
  const targetRevenue = selectedVariant ? getVariantRevenue(selectedVariant.id, topProducts) : productRevenue;
  const soldCount = selectedVariant ? getVariantQuantity(selectedVariant.id, topProducts) : productQuantity;
  const share = totalRevenue > 0 ? targetRevenue / totalRevenue : 0;

  // Günlük seri: ciro = pay × günlük mağaza cirosu; adet = hedef adet günlük ciroya orantılı dağıtılır.
  const dailySeries = useMemo<DaySeriesPoint[]>(
    () =>
      dailyRevenue.map(d => ({
        date: d.date,
        revenue: Math.round(d.revenue * share * 100) / 100,
        units: sumDaily > 0 ? soldCount * (d.revenue / sumDaily) : 0,
      })),
    [dailyRevenue, share, soldCount, sumDaily],
  );

  const periodRevenue = useMemo(() => dailySeries.reduce((s, d) => s + d.revenue, 0), [dailySeries]);
  const hasData = targetRevenue > 0 && dailyRevenue.length > 0 && periodRevenue > 0;

  const maxStock = useMemo(() => variants.reduce((m, v) => Math.max(m, getVariantStock(v)), 0), [variants]);

  // Kartları önem sırasına diz: tükenen → az kalan → sağlıklı.
  const variantsSorted = useMemo(
    () =>
      [...variants].sort((a, b) => {
        const sa = STATUS_SEVERITY[stockToStatus(getVariantStock(a), criticalThreshold, warningThreshold)];
        const sb = STATUS_SEVERITY[stockToStatus(getVariantStock(b), criticalThreshold, warningThreshold)];
        return sa - sb || getVariantStock(a) - getVariantStock(b);
      }),
    [variants, criticalThreshold, warningThreshold],
  );

  return (
    <div className="flex max-h-[85vh] flex-col max-sm:max-h-full">
      {/* Başlık — tam genişlik, yatay */}
      <div className="flex items-start gap-4 border-b border-[#e5e7eb] p-6 pb-4 pr-12">
        <ModalProductImage src={productImage} alt={product.name} />
        <div className="flex min-w-0 flex-col gap-2">
          <DialogTitle className="text-[24px] font-semibold leading-[1.2] tracking-tight text-[#17171c]">
            {product.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {product.name} ürününün varyant ve satış detayları
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <span className="inline-flex rounded-full bg-[#f1f5ff] px-2.5 py-0.5 text-[12px] font-medium text-[#1863dc]">
                {category}
              </span>
            )}
            <ModalStatusBadge status={overallStatus} />
          </div>
          <span className="text-[14px] text-[#75758a]">
            {variants.length} varyant • Toplam {totalStock} adet stok
          </span>
        </div>
      </div>

      {/* Gövde — iki kolon: sol sabit 380px, sağ esner (grafik) */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 md:flex-row md:gap-0">
        {/* Sol panel */}
        <div className="flex flex-col gap-4 md:w-[380px] md:flex-shrink-0 md:pr-5">
          <TumuCard
            totalStock={totalStock}
            productRevenue={productRevenue}
            variantCount={variants.length}
            status={overallStatus}
            selected={selectedVariantId === 'all'}
            onClick={() => setSelectedVariantId('all')}
          />
          {variantsSorted.length > 0 && (
            <div>
              <MonoLabel className="mb-2">Varyantlar</MonoLabel>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {variantsSorted.map(v => {
                  const stock = getVariantStock(v);
                  const price = v.prices?.[0]?.sellPrice ?? 0;
                  return (
                    <VariantCard
                      key={v.id}
                      label={getVariantName(v)}
                      stock={stock}
                      priceLabel={price > 0 ? formatPrice(price) : '—'}
                      status={stockToStatus(stock, criticalThreshold, warningThreshold)}
                      selected={selectedVariantId === v.id}
                      fillPercent={maxStock > 0 ? Math.min((stock / maxStock) * 100, 100) : 0}
                      onClick={() => setSelectedVariantId(v.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sağ panel — grafik (mobilde Tümü/varyantlardan önce) */}
        <div className="order-first flex min-w-0 flex-1 md:order-none">
          <SalesChart
            dailySeries={dailySeries}
            soldCount={soldCount}
            hasData={hasData}
            variantLabel={selectedVariant ? getVariantName(selectedVariant) : 'Tüm Varyantlar'}
          />
        </div>
      </div>
    </div>
  );
};
