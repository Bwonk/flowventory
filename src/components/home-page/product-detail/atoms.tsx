'use client';

import React, { useState } from 'react';
import { Package } from 'lucide-react';

/** Görsele (ilk varyant görseli) sahip aydınlık modal başlık görseli. */
export const ModalProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-[#f8f9fa] p-1 lg:h-[72px] lg:w-[72px]">
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
      className="h-16 w-16 shrink-0 rounded-xl border border-border object-contain p-1 lg:h-[72px] lg:w-[72px]"
    />
  );
};
