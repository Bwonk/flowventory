'use client';

import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { AgingBucketKey } from '@/lib/reports/abc';
import { formatPrice } from '@/lib/currency';
import type { AgingFilter } from './constants';

interface AgingSectionProps {
  buckets: InventoryInsightApiResponse['agingBuckets'];
  selected: AgingFilter;
  onSelect: (bucket: AgingBucketKey) => void;
}

/**
 * Stok yaşlandırma kovaları — kova başına bağlı sermaye.
 * Kovalar tıklanınca tabloyu o kovaya filtreler (tekrar tıklama temizler).
 */
export function AgingSection({ buckets, selected, onSelect }: AgingSectionProps) {
  const totalValue = buckets.reduce((s, b) => s + b.stockValue, 0);

  return (
    <section className="mb-4 rounded-lg border border-hairline bg-card p-5">
      <h2 className="text-sm font-medium text-foreground">Stok Yaşlandırma</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Mevcut stok kaç günlük satışa yetiyor — kova başına bağlı sermaye
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {buckets.map(bucket => {
          const pct = totalValue > 0 ? (bucket.stockValue / totalValue) * 100 : 0;
          const risky = bucket.bucket === '180+' || bucket.bucket === 'satışsız';
          const isSelected = selected === bucket.bucket;
          return (
            <button
              key={bucket.bucket}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(bucket.bucket)}
              className={`flex flex-col gap-1.5 rounded-md p-2 -m-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                isSelected ? 'bg-muted' : 'hover:bg-muted/40'
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {bucket.bucket === 'satışsız' ? 'SATIŞSIZ' : `${bucket.bucket} GÜN`}
              </p>
              <p className={`font-mono text-xl font-medium tabular-nums ${risky && bucket.stockValue > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatPrice(bucket.stockValue)}
              </p>
              <p className="text-xs text-muted-foreground">{bucket.productCount} ürün</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={risky ? 'h-full bg-status-critical' : 'h-full bg-status-healthy'}
                  style={{ width: `${Math.max(pct, bucket.stockValue > 0 ? 4 : 0)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
