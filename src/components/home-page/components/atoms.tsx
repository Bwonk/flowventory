'use client';

import React, { useState } from 'react';
import { Package, X } from 'lucide-react';

export const MonoLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <p className={`font-mono text-[12px] uppercase tracking-[0.08em] text-[#75758a] ${className ?? ''}`}>
    {children}
  </p>
);

/** Ürün görseli; kaynak yoksa veya yüklenemezse nötr placeholder'a düşer. */
export const ProductThumb: React.FC<{ src?: string; alt: string; sizeClass?: string }> = ({
  src,
  alt,
  sizeClass = 'h-10 w-10',
}) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={`flex ${sizeClass} items-center justify-center rounded-lg bg-[#eeece7]`}>
        <Package className="h-4 w-4 text-[#93939f]" />
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
      className={`${sizeClass} rounded-lg object-cover`}
    />
  );
};

export const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <button
    type="button"
    onClick={onRemove}
    className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] px-3 py-1 text-[14px] text-[#374151] transition-colors hover:bg-[#e5e7eb] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4c6ee6]"
  >
    {label}
    <X className="h-3.5 w-3.5 text-[#374151]" />
  </button>
);
