'use client';

import React, { useState } from 'react';
import { Package } from 'lucide-react';
import type { ProductStatus } from '../types';
import { MODAL_STATUS_META } from '../constants';

export const ModalStatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const meta = MODAL_STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
};

/** Görsele (ilk varyant görseli) sahip aydınlık modal başlık görseli. */
export const ModalProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f8f9fa]">
        <Package className="h-7 w-7 text-[#93939f]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="h-24 w-24 shrink-0 rounded-xl border border-[#e5e7eb] object-cover"
    />
  );
};
