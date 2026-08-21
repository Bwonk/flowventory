'use client';

import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { formatPrice } from '@/lib/currency';
import { ABC_BADGE_CLASS, ABC_LABELS } from './constants';

interface AbcSectionProps {
  summary: InventoryInsightApiResponse['abcSummary'];
}

/** ABC özet kartları — sınıf başına ürün sayısı, ciro payı, bağlı stok. */
export function AbcSection({ summary }: AbcSectionProps) {
  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="grid grid-cols-1 md:grid-cols-3">
        {summary.map(row => (
          <div key={row.class} className="border-b border-r border-border p-5 last:border-b-0 md:border-b-0 md:last:border-r-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${ABC_BADGE_CLASS[row.class]}`}>
                {row.class}
              </span>
              <p className="text-sm font-medium text-foreground">{ABC_LABELS[row.class].title}</p>
            </div>
            <p className="mt-3 font-mono text-xl font-medium tabular-nums xl:text-2xl text-foreground">{row.productCount} ürün</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ciro payı %{(row.revenueShare * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ·
              bağlı stok {formatPrice(row.stockValue)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{ABC_LABELS[row.class].description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
