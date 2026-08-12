'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { AbcClass } from '@/lib/reports/abc';
import { ErrorState } from '@/components/shared/ErrorState';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, useMerchantCurrency } from '@/lib/currency';

const ABC_LABELS: Record<AbcClass, { title: string; description: string }> = {
  A: { title: 'A Sınıfı', description: 'Cironun ~%80\'i — sürekli izle, asla tükettirme' },
  B: { title: 'B Sınıfı', description: 'Cironun ~%15\'i — düzenli kontrol yeterli' },
  C: { title: 'C Sınıfı', description: 'Cironun ~%5\'i — stok bağlama, azaltmayı düşün' },
};

const ABC_BADGE_CLASS: Record<AbcClass, string> = {
  A: 'bg-emerald-50 text-emerald-800',
  B: 'bg-amber-50 text-amber-800',
  C: 'bg-muted text-muted-foreground',
};

function AnalizSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-56" />
      <Skeleton className="mb-4 h-32 rounded-xl" />
      <Skeleton className="mb-4 h-40 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

/**
 * Analiz sayfası — ABC (ciro Pareto'su) + stok yaşlandırma.
 * Hangi ürüne dikkat, hangisine sermaye azaltma kararı için tek ekran.
 */
export default function AnalizPage() {
  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();
  const [insight, setInsight] = useState<InventoryInsightApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const res = await ApiRequests.insights.inventory(token);
      if (res.status === 200 && res.data?.data) {
        setInsight(res.data.data);
      } else {
        setError('Analiz verisi alınamadı.');
      }
    } catch (error) {
      logger.error('Error initializing analysis page', { error });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <AnalizSkeleton />;
  if (error) return <ErrorState description={error} onRetry={initialize} />;
  if (!insight) return null;

  const totalAgingValue = insight.agingBuckets.reduce((s, b) => s + b.stockValue, 0);
  const hasEstimate = insight.items.some(i => i.isEstimate && i.totalStock > 0);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate">ANALİZ</p>
      <h1 className="mb-2 text-4xl font-normal tracking-[-0.04em] text-primary">Envanter Analizi</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Son {insight.windowDays} günün satışına göre ABC sınıflandırması ve stok yaşlandırma
        {hasEstimate && ' · ~ işaretli değerler alış fiyatı yerine satış fiyatıyla hesaplandı'}
      </p>

      {/* ABC özeti */}
      <section className="mb-4 overflow-hidden rounded-xl border border-border bg-background">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {insight.abcSummary.map(row => (
            <div key={row.class} className="border-b border-r border-border p-5 last:border-b-0 md:border-b-0 md:last:border-r-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${ABC_BADGE_CLASS[row.class]}`}>
                  {row.class}
                </span>
                <p className="text-sm font-medium text-foreground">{ABC_LABELS[row.class].title}</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{row.productCount} ürün</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ciro payı %{(row.revenueShare * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ·
                bağlı stok {formatPrice(row.stockValue)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{ABC_LABELS[row.class].description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Yaşlandırma */}
      <section className="mb-4 rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-medium text-foreground">Stok Yaşlandırma</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mevcut stok kaç günlük satışa yetiyor — kova başına bağlı sermaye
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {insight.agingBuckets.map(bucket => {
            const pct = totalAgingValue > 0 ? (bucket.stockValue / totalAgingValue) * 100 : 0;
            const risky = bucket.bucket === '180+' || bucket.bucket === 'satışsız';
            return (
              <div key={bucket.bucket} className="flex flex-col gap-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {bucket.bucket === 'satışsız' ? 'SATIŞSIZ' : `${bucket.bucket} GÜN`}
                </p>
                <p className={`text-xl font-semibold tracking-tight ${risky && bucket.stockValue > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatPrice(bucket.stockValue)}
                </p>
                <p className="text-xs text-muted-foreground">{bucket.productCount} ürün</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={risky ? 'h-full bg-status-critical' : 'h-full bg-status-healthy'}
                    style={{ width: `${Math.max(pct, bucket.stockValue > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ürün tablosu */}
      <section className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium text-foreground">Ürün Detayı</h2>
          <p className="text-xs text-muted-foreground">Ciroya göre sıralı</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-normal">Ürün</th>
                <th className="px-3 py-2 text-center font-normal">Sınıf</th>
                <th className="px-3 py-2 text-right font-normal">Ciro (30g)</th>
                <th className="px-3 py-2 text-right font-normal">Satış</th>
                <th className="px-3 py-2 text-right font-normal">Stok</th>
                <th className="px-3 py-2 text-right font-normal">Stok Ömrü</th>
                <th className="px-5 py-2 text-right font-normal">Bağlı Sermaye</th>
              </tr>
            </thead>
            <tbody>
              {insight.items.slice(0, 25).map(item => (
                <tr key={item.productId} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded object-cover"
                          unoptimized
                        />
                      )}
                      <span className="truncate font-medium text-foreground">{item.productName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${ABC_BADGE_CLASS[item.abcClass]}`}>
                      {item.abcClass}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(item.revenue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.soldQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.totalStock}</td>
                  <td className="px-3 py-2.5 text-right">
                    {item.totalStock === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <StockLifeBadge days={item.daysOfStock} />
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                    {formatPrice(item.stockValue)}
                    {item.isEstimate && item.totalStock > 0 && (
                      <span className="text-xs text-muted-foreground" title="Alış fiyatı tanımlı değil">~</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
