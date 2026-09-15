import type { ReactNode } from 'react';

/**
 * Kanonik tablo alt bölgesi notu: sonuç sayısı, kesme notu gibi tek satırlık
 * bilgi. 48px — `InfiniteScrollFooter` ile aynı yükseklik.
 */
export function TableFooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex h-12 items-center justify-center border-t border-border px-5 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
