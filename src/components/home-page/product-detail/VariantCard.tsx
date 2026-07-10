'use client';

import React, { useEffect, useState } from 'react';
import type { ProductStatus } from '../types';
import { statusFillColor } from '../lib/product';

/** Kompakt varyant kartı: ad + durum noktası, büyük stok, ince bar, fiyat. */
export const VariantCard: React.FC<{
  label: string;
  stock: number;
  priceLabel: string;
  status: ProductStatus;
  selected: boolean;
  fillPercent: number;
  onClick: () => void;
}> = ({ label, stock, priceLabel, status, selected, fillPercent, onClick }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let stateClass: string;
  if (selected) stateClass = 'border-[#17171c] bg-[#f8f9fa]';
  else if (status === 'critical') stateClass = 'border-[#fca5a5] bg-[#fef2f2] hover:opacity-90';
  else if (status === 'warning') stateClass = 'border-[#fcd34d] bg-[#fffbeb] hover:opacity-90';
  else stateClass = 'border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f8f9fa]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${stateClass}`}
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-[14px] font-medium text-[#17171c]">{label}</span>
        <span
          className="ml-auto h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: statusFillColor(status) }}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[20px] font-semibold leading-none text-[#17171c]">{stock}</span>
        <span className="text-[13px] text-[#75758a]">adet</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${mounted ? fillPercent : 0}%`, backgroundColor: statusFillColor(status) }}
        />
      </div>
      <span className="mt-2 text-[13px] text-[#75758a]">{priceLabel}</span>
    </button>
  );
};
