'use client';

import Image from 'next/image';
import type { InventoryInsightItem } from '@/app/api/insights/inventory/route';
import { SellThroughBadge } from '@/components/shared/badges/SellThroughBadge';
import { StockLifeBadge } from '@/components/shared/badges/StockLifeBadge';
import { formatPrice } from '@/lib/currency';
import { formatDateKey } from '@/lib/format';
import { ABC_BADGE_CLASS } from './constants';

interface AnalysisTableProps {
  items: InventoryInsightItem[];
  windowDays: number;
}

/**
 * "Tükeniş" sütunu metni. Üç ayrı "tarih yok" hâli var ve karıştırılmamalı:
 * stok zaten bitmiş, satış olmadığı için tahmin edilemiyor, tahmin 2 yılın
 * ötesinde (pratikte ölü stok).
 */
function stockoutLabel(item: InventoryInsightItem): string {
  if (item.totalStock === 0) return 'tükendi';
  if (item.daysOfStock === null) return 'satış yok';
  return formatDateKey(item.stockoutDate) ?? '2+ yıl';
}

/** Ürün detay tablosu — ciroya göre sıralı. */
export function AnalysisTable({ items, windowDays }: AnalysisTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-card">
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
              <th className="px-3 py-2 text-right font-normal">Ciro ({windowDays}g)</th>
              <th className="px-3 py-2 text-right font-normal">Satış</th>
              <th className="px-3 py-2 text-right font-normal">Stok</th>
              <th className="px-3 py-2 text-right font-normal" title="Satılan ÷ (satılan + kalan)">
                Sell-through
              </th>
              <th className="px-3 py-2 text-right font-normal">Stok Ömrü</th>
              <th className="px-3 py-2 text-right font-normal">Tükeniş</th>
              <th className="px-5 py-2 text-right font-normal">Bağlı Sermaye</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 25).map(item => (
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
                  <SellThroughBadge rate={item.sellThrough} band={item.sellThroughBand} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  {item.totalStock === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <StockLifeBadge days={item.daysOfStock} />
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                  <span
                    className={
                      item.stockoutBeforeLeadTime && item.totalStock > 0
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {stockoutLabel(item)}
                  </span>
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
  );
}
