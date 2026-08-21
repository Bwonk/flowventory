'use client';

import { useInfiniteScroll } from './use-infinite-scroll';

interface InfiniteScrollFooterProps {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Satır sayısı 0 ise "listelendi" mesajı gösterilmez (boş durum ayrı ele alınır). */
  itemCount: number;
  endText?: string;
}

/** Tablo altı: sentinel + yükleniyor / "Tüm ürünler listelendi" şeridi. */
export function InfiniteScrollFooter({
  hasMore,
  loadingMore,
  onLoadMore,
  itemCount,
  endText = 'Tüm ürünler listelendi',
}: InfiniteScrollFooterProps) {
  const sentinelRef = useInfiniteScroll(hasMore, loadingMore, onLoadMore);

  return (
    <>
      {hasMore && <div ref={sentinelRef} className="h-px" />}
      {loadingMore && (
        <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">Yükleniyor…</p>
      )}
      {!hasMore && itemCount > 0 && (
        <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">{endText}</p>
      )}
    </>
  );
}
