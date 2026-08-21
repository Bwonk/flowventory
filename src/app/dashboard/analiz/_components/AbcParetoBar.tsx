'use client';

import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import type { AbcClass } from '@/lib/reports/abc';
import { formatPercent } from '@/lib/format';

interface AbcParetoBarProps {
  summary: InventoryInsightApiResponse['abcSummary'];
}

const CLASS_ORDER: AbcClass[] = ['A', 'B', 'C'];

const SEGMENT_CLASS: Record<AbcClass, string> = {
  A: 'bg-status-healthy',
  B: 'bg-status-warning',
  C: 'bg-muted-foreground/40',
};

interface BarRowProps {
  label: string;
  shares: Record<AbcClass, number>;
}

function BarRow({ label, shares }: BarRowProps) {
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div
        className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={CLASS_ORDER.map(cls => `${cls} ${formatPercent(shares[cls], 0)}`).join(', ')}
      >
        {CLASS_ORDER.map(
          cls =>
            shares[cls] > 0 && (
              <div key={cls} className={SEGMENT_CLASS[cls]} style={{ width: `${shares[cls] * 100}%` }} />
            ),
        )}
      </div>
      <p className="w-40 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {CLASS_ORDER.map(cls => `${cls} ${formatPercent(shares[cls], 0)}`).join(' · ')}
      </p>
    </div>
  );
}

/**
 * Pareto karşılaştırma barları — sınıf başına ciro payı ile bağlı sermaye payını
 * yan yana koyar. Asıl içgörü uyumsuzluk: C sınıfı cironun küçük bir dilimini
 * üretirken sermayenin büyük dilimini bağlıyorsa ölü ağırlık orada.
 */
export function AbcParetoBar({ summary }: AbcParetoBarProps) {
  const totalStockValue = summary.reduce((s, r) => s + r.stockValue, 0);
  const totalCount = summary.reduce((s, r) => s + r.productCount, 0);
  if (totalCount === 0) return null;

  const byClass = new Map(summary.map(r => [r.class, r]));
  const share = (fn: (row: (typeof summary)[0]) => number): Record<AbcClass, number> => {
    const result = {} as Record<AbcClass, number>;
    for (const cls of CLASS_ORDER) {
      const row = byClass.get(cls);
      result[cls] = row ? fn(row) : 0;
    }
    return result;
  };

  const revenueShares = share(r => r.revenueShare);
  const stockShares = share(r => (totalStockValue > 0 ? r.stockValue / totalStockValue : 0));
  const countShares = share(r => r.productCount / totalCount);

  const cRow = byClass.get('C');
  const insight =
    cRow && totalStockValue > 0 && cRow.stockValue > 0
      ? `C sınıfı cironun ${formatPercent(revenueShares.C, 0)}'ini üretip sermayenin ${formatPercent(stockShares.C, 0)}'ini bağlıyor.`
      : null;

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="space-y-2.5">
        <BarRow label="Ciro payı" shares={revenueShares} />
        <BarRow label="Bağlı sermaye" shares={stockShares} />
        <BarRow label="Ürün adedi" shares={countShares} />
      </div>
      {insight && <p className="mt-3 text-xs text-muted-foreground">{insight}</p>}
    </div>
  );
}
