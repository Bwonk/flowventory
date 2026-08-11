'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { ConversionInsightApiResponse } from '@/app/api/insights/conversion/route';

function formatPercent(rate: number): string {
  return `%${(rate * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

/**
 * Görüntülenme → satış dönüşümü kartı.
 *
 * Tracker'ın topladığı görüntülenme verisini satışla birleştirir;
 * "çok görüntülenen ama az satan" ürünleri öne çıkarır (fiyat/görsel/açıklama
 * sorununun en güçlü sinyali).
 */
export function ConversionInsightCard({ insight }: { insight: ConversionInsightApiResponse | null }) {
  if (!insight || insight.totalViews === 0) {
    return (
      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-medium text-foreground">Görüntülenme → Satış Dönüşümü</h2>
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
          <Eye className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Henüz görüntülenme verisi yok</p>
          <p className="text-xs text-muted-foreground">
            Ürün görüntülenmelerini toplamak için{' '}
            <Link href="/dashboard/ayarlar" className="underline hover:text-foreground">
              Ayarlar&apos;dan takip scriptini kurun
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  const flagged = insight.items.filter(i => i.lowConversion).length;

  return (
    <section className="rounded-xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Görüntülenme → Satış Dönüşümü</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Son {insight.windowDays} gün · mağaza ortalaması {formatPercent(insight.overallConversionRate)}
          </p>
        </div>
        {flagged > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {flagged} ürün ilgi görüyor ama satmıyor
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3 font-normal">Ürün</th>
              <th className="px-3 py-2 text-right font-normal">Görüntülenme</th>
              <th className="px-3 py-2 text-right font-normal">Satış</th>
              <th className="py-2 pl-3 text-right font-normal">Dönüşüm</th>
            </tr>
          </thead>
          <tbody>
            {insight.items.slice(0, 8).map(item => (
              <tr key={item.productId} className="border-b border-border last:border-b-0">
                <td className="py-2.5 pr-3">
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
                    {item.lowConversion && (
                      <span
                        className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                        title="Görüntülenmesi yüksek, dönüşümü mağaza ortalamasının yarısının altında — fiyat, görsel veya açıklamayı gözden geçirin"
                      >
                        düşük dönüşüm
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.views.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{item.soldQty.toLocaleString('tr-TR')}</td>
                <td className="py-2.5 pl-3 text-right font-medium tabular-nums">
                  {formatPercent(item.conversionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
