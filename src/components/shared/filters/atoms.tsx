'use client';

import React, { useState } from 'react';
import { Package } from 'lucide-react';

export const MonoLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <p className={`font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground ${className ?? ''}`}>
    {children}
  </p>
);

/** Ürün görseli; kaynak yoksa veya yüklenemezse nötr placeholder'a düşer. */
export const ProductThumb: React.FC<{ src?: string; alt: string; sizeClass?: string; roundedClass?: string }> = ({
  src,
  alt,
  sizeClass = 'h-10 w-10',
  roundedClass = 'rounded-lg',
}) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={`flex ${sizeClass} shrink-0 items-center justify-center ${roundedClass} bg-muted`}>
        <Package className="h-4 w-4 text-muted-foreground" />
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
      className={`${sizeClass} shrink-0 ${roundedClass} object-cover`}
    />
  );
};
