'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import { useStockThreshold } from '@/lib/stock-threshold';
import type { Product } from '../types';
import { ProductDetailContent } from './ProductDetailContent';

interface ProductDetailModalProps {
  product: Product | null;
  analytics: AnalyticsApiResponse | null;
  onClose: () => void;
}

/** Ürün detay modalı: Dialog kabuğu + eşik okuma (prop taşımadan). */
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, analytics, onClose }) => {
  const { threshold } = useStockThreshold();

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-5xl gap-0 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-0 shadow-sm sm:max-w-5xl max-sm:left-0 max-sm:top-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        {product && (
          <ProductDetailContent
            key={product.id}
            product={product}
            analytics={analytics}
            criticalThreshold={threshold.min}
            warningThreshold={threshold.max}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
