'use client';

import React from 'react';
import type { ProductStatus } from '../types';
import { formatPrice } from '../lib/format';
import { ModalStatusBadge } from './atoms';

/** Sol kolon hero kartı: stok, ciro, görüntülenme, stok ömrü. */
export const TumuCard: React.FC<{
  totalStock: number;
  productRevenue: number;
  totalViews?: number;
  daysRemaining?: number | null;
  variantCount: number;
  status: ProductStatus;
  selected: boolean;
  onClick: () => void;
}> = ({ totalStock, productRevenue, totalViews, daysRemaining, variantCount, status, selected, onClick }) => {
  const daysLabel = daysRemaining === 0 ? 'Tükendi' : daysRemaining == null ? '—' : daysRemaining > 365 ? '365+ gün' : `${daysRemaining} gün`;
  const daysColor = daysRemaining === 0 ? 'text-[#b30000]' : daysRemaining != null && daysRemaining <= 7 ? 'text-[#b30000]' : daysRemaining != null && daysRemaining <= 30 ? 'text-[#d97706]' : 'text-[#17171c]';

  return (
    <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex w-full flex-col rounded-xl p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6] ${
      selected ? 'border-2 border-[#17171c] bg-[#ffffff]' : 'border border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f8f9fa]'
    }`}
  >
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">Toplam Stok</span>
        <span className="text-[24px] font-semibold leading-tight tracking-tight text-[#17171c]">{totalStock}</span>
        <span className="text-[13px] text-[#75758a]">adet</span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">30 Günlük Ciro</span>
        <span className="text-[20px] font-semibold leading-tight tracking-tight text-[#17171c]">
          {formatPrice(productRevenue)}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">30 Günlük Görüntülenme</span>
        <span className="text-[24px] font-semibold leading-tight tracking-tight text-[#17171c]">
          {totalViews ?? '—'}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#75758a]">Stok Ömrü</span>
        <span className={`text-[24px] font-semibold leading-tight tracking-tight ${daysColor}`}>
          {daysLabel}
        </span>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e5e7eb] pt-3">
      <ModalStatusBadge status={status} />
      <span className="text-[13px] text-[#75758a]">{variantCount} varyant</span>
    </div>
  </button>
  );
};
