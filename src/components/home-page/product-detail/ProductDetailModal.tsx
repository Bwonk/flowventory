'use client';

import React from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { XIcon } from 'lucide-react';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import { useStockThreshold } from '@/lib/stock-threshold';
import type { Product } from '../types';
import { ProductDetailContent } from './ProductDetailContent';

interface ProductDetailModalProps {
  product: Product | null;
  analytics: AnalyticsApiResponse | null;
  token: string | null;
  viewStats?: Record<string, number> | null;
  onClose: () => void;
}

/** Ürün detay modalı: Dialog kabuğu + eşik okuma (prop taşımadan). */
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, analytics, token, viewStats, onClose }) => {
  const { threshold } = useStockThreshold();
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent 
        ref={(node) => setPortalContainer(node)}
        showCloseButton={false} 
        className="w-[92vw] max-w-7xl md:h-[780px] md:max-h-[90vh] gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-sm sm:max-w-7xl max-sm:left-0 max-sm:top-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        {product && (
          <ProductDetailContent
            key={product.id}
            product={product}
            token={token}
            viewStats={viewStats}
            analytics={analytics}
            criticalThreshold={threshold.min}
            warningThreshold={threshold.max}
            portalContainer={portalContainer}
          />
        )}
        <DialogClose
          className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Kapat"
        >
          <XIcon className="size-4" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};
