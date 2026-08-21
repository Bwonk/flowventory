import type { ReactNode } from 'react';

/** Kanonik tablo alt şeridi: sonuç sayısı, kesme notu gibi tek satırlık bilgi. */
export function TableFooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
