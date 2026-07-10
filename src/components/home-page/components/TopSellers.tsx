'use client';

import React from 'react';
import type { TopProduct } from '../types';
import { MonoLabel } from './atoms';

interface TopSellersProps {
  topProducts: TopProduct[];
}

/** En çok satanlar — research-table stili kural ayrımlı liste (son 30 gün). */
export const TopSellers: React.FC<TopSellersProps> = ({ topProducts }) => {
  if (topProducts.length === 0) return null;

  return (
    <section className="mt-10">
      <MonoLabel className="mb-4">En Çok Satanlar · Son 30 Gün</MonoLabel>
      <div className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-[#ffffff]">
        {topProducts.slice(0, 5).map((p, i) => (
          <div
            key={p.variantId || i}
            className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] px-6 py-5 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="font-mono text-[14px] tabular-nums text-[#93939f]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="truncate text-[16px] font-medium text-[#17171c]">{p.sku}</span>
            </div>
            <div className="flex shrink-0 items-center gap-6">
              <span className="text-[14px] text-[#75758a]">{p.quantity} adet</span>
              <span className="text-[16px] font-medium tracking-[-0.02em] text-[#17171c]">
                ₺{p.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
