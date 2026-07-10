'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalResults: number;
  visibleCount: number;
  onPrev: () => void;
  onNext: () => void;
}

/** Client-side sayfalama kontrolü: sayfa özeti + önceki/sonraki. */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalResults,
  visibleCount,
  onPrev,
  onNext,
}) => (
  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-[14px] text-[#75758a]">
      {totalResults} ürün gösteriliyor, {visibleCount} tanesi bu sayfada
    </p>
    <div className="flex items-center gap-3">
      <Button
        onClick={onPrev}
        disabled={page <= 1}
        className="h-10 gap-1 rounded-full border border-[#e5e7eb] bg-[#ffffff] px-4 text-[14px] font-medium text-[#17171c] shadow-none transition-colors hover:bg-[#f2f2f2] disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Önceki
      </Button>
      <span className="whitespace-nowrap text-[14px] text-[#17171c]">
        Sayfa {page} / {totalPages}
      </span>
      <Button
        onClick={onNext}
        disabled={page >= totalPages}
        className="h-10 gap-1 rounded-full border border-[#e5e7eb] bg-[#ffffff] px-4 text-[14px] font-medium text-[#17171c] shadow-none transition-colors hover:bg-[#f2f2f2] disabled:opacity-40"
      >
        Sonraki
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);
