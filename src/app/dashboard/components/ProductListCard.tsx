'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Package, type LucideIcon } from 'lucide-react';

export interface ProductListItem {
  productId: string;
  index: number;
  image?: string;
  name: string;
  meta: string;
  status?: { text: string; className: string };
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
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f8f9fa]">
        <Package className="h-5 w-5 text-[#d1d5db]" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 flex-shrink-0 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] object-cover"
      onError={() => setFailed(true)}
    />
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
    <section className="flex flex-col rounded-2xl border border-[#e5e7eb] bg-[#ffffff] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-[#17171c]">{title}</h2>
          <p className="mt-0.5 text-xs text-[#75758a]">{subtitle}</p>
        </div>
        {badge && (
          <span className={badge.className}>{badge.text}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-10">
          <emptyState.icon className="mb-3 h-8 w-8 text-[#75758a]" />
          <p className="text-sm font-medium text-[#17171c]">{emptyState.title}</p>
          <p className="mt-1 text-xs text-[#75758a]">{emptyState.description}</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f3f4f6]">
          {items.map(item => (
            <Link
              key={item.productId}
              href={`/dashboard/stok?product=${item.productId}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-[#f8f9fa] cursor-pointer"
            >
              <span className="w-6 flex-shrink-0 text-center font-mono text-xs text-[#75758a]">
                {String(item.index).padStart(2, '0')}
              </span>
              <ProductImage src={item.image} alt={item.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#17171c]">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#75758a]">{item.meta}</p>
              </div>
              {item.status && (
                <span className={item.status.className}>{item.status.text}</span>
              )}
              <Eye className="h-4 w-4 flex-shrink-0 text-[#9ca3af] transition-colors group-hover:text-[#17171c]" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
