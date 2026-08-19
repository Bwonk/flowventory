'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Package, type LucideIcon } from 'lucide-react';
import type { StockStatus } from '@/components/shared/badges/StatusBadge';
import { StatusBadge } from '@/components/shared/badges/StatusBadge';
import { EyeIcon } from '@/components/ui/icons/eye';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';

export interface ProductListItem {
  productId: string;
  index: number;
  image?: string;
  name: string;
  meta: string;
  status?: StockStatus;
}

interface ProductListCardProps {
  title: string;
  subtitle: string;
  badge?: { text: string; className: string };
  items: ProductListItem[];
  emptyState: { icon: LucideIcon; title: string; description: string };
}

const ProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
        <Package className="h-5 w-5 text-hairline" />
      </div>
    );
  }
  return (
    // unoptimized: görseller ikas CDN'inde, Next optimizer'ından geçirmeye gerek yok
    // (ConversionInsightCard ile aynı kullanım).
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="h-10 w-10 flex-shrink-0 rounded-lg border border-border bg-muted object-cover"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
};

/**
 * Tek ürün satırı. Her satırın kendi göz ikonu ref'i gerektiği için ayrı
 * bileşen: hook'u map gövdesinde çağırmak Rules of Hooks ihlali olurdu.
 */
const ProductRow: React.FC<{ item: ProductListItem }> = ({ item }) => {
  const { ref, hoverProps } = useIconHover();

  return (
    <Link
      href={`/dashboard/stok?product=${item.productId}`}
      className="group flex items-center gap-3 rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-muted cursor-pointer"
      {...hoverProps}
    >
      <span className="w-6 flex-shrink-0 text-center font-mono text-xs text-muted-foreground">
        {String(item.index).padStart(2, '0')}
      </span>
      <ProductImage src={item.image} alt={item.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-primary">{item.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
      </div>
      {item.status && (
        <StatusBadge status={item.status} size="sm" />
      )}
      <EyeIcon
        ref={ref}
        size={16}
        className="flex flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
};

export const ProductListCard: React.FC<ProductListCardProps> = ({
  title,
  subtitle,
  badge,
  items,
  emptyState,
}) => {
  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {badge && (
          <span className={badge.className}>{badge.text}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-10">
          <emptyState.icon className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-primary">{emptyState.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
        </div>
      ) : (
        <div className="divide-y divide-muted">
          {items.map(item => (
            <ProductRow key={item.productId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};
