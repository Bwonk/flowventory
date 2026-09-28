'use client';

import React from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import { CloseButton } from '@/components/ui/close-button';
import { useStockThreshold } from '@/lib/stock-threshold';
import type { Product } from '@/lib/products/types';
import type { VariantStockChange } from '@/lib/products/product';
import { ProductDetailContent } from './ProductDetailContent';

interface ProductDetailModalProps {
  product: Product | null;
  analytics: AnalyticsApiResponse | null;
  token: string | null;
  viewStats?: Record<string, number> | null;
  onClose: () => void;
  /** Stok düzenlemesi onaylanınca üst listeyi güncellemek için (opsiyonel). */
  onVariantStockChange?: (change: VariantStockChange) => void;
}

/** Ürün detay modalı: Dialog kabuğu + eşik okuma (prop taşımadan). */
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, analytics, token, viewStats, onClose, onVariantStockChange }) => {
  const { threshold } = useStockThreshold();
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  // Kapanışta `product` hemen null olur; Dialog'un 150ms çıkışı boş kart
  // üzerinde oynamasın diye son ürün tutulur (önceki render'dan bilgi saklama
  // kalıbı — ref yerine state, StrictMode güvenli). Dialog çıkıştan sonra
  // içeriği zaten kaldırır.
  const [shownProduct, setShownProduct] = React.useState(product);
  if (product && product !== shownProduct) setShownProduct(product);

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent 
        ref={(node) => setPortalContainer(node)}
        showCloseButton={false} 
        className="w-[92vw] max-w-7xl md:h-[780px] md:max-h-[90vh] grid-rows-[minmax(0,1fr)] gap-0 overflow-visible rounded-xl border border-border bg-card p-0 shadow-sm sm:max-w-7xl max-sm:left-0 max-sm:top-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
        // İçeride goo açılır (tarih seçici, stok onayı) açıksa Esc yalnız onu
        // kapatsın; Radix'in Esc'i yakalama fazında önce buraya gelir.
        onEscapeKeyDown={(e) => {
          if (portalContainer?.querySelector('[data-goo-popover-portal]')) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Kırpma kabukta değil bu katmanda: popover'lar (tarih seçici, stok
            onayı) kabuğa portallanır ve modal kenarından taşabilir — kabuk
            overflow-hidden iken takvimin alt butonları kesiliyordu. */}
        <div className="h-full min-h-0 overflow-hidden rounded-[inherit]">
          {shownProduct && (
            <ProductDetailContent
              key={shownProduct.id}
              product={shownProduct}
              token={token}
              viewStats={viewStats}
              analytics={analytics}
              criticalThreshold={threshold.min}
              warningThreshold={threshold.max}
              portalContainer={portalContainer}
              onVariantStockChange={onVariantStockChange}
            />
          )}
        </div>
        <DialogClose asChild>
          <CloseButton aria-label="Kapat" className="absolute right-4 top-4 z-10 size-10 opacity-70 hover:opacity-100" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};
