'use client';

import { formatNumber } from '@/lib/format';
import { TableFooterNote } from './TableFooterNote';
import { useInfiniteScroll } from './use-infinite-scroll';

interface InfiniteScrollFooterProps {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Ekrandaki satır sayısı; liste bittiğinde toplam sonuç sayısına eşittir. */
  itemCount: number;
  /** Sayının yanındaki tekil isim ("ürün", "sipariş"...). */
  itemNoun?: string;
}

/** Tablo altı: sentinel + yükleniyor / "N ürün listelendi" şeridi. */
export function InfiniteScrollFooter({
  hasMore,
  loadingMore,
  onLoadMore,
  itemCount,
  itemNoun = 'ürün',
}: InfiniteScrollFooterProps) {
  const sentinelRef = useInfiniteScroll(hasMore, loadingMore, onLoadMore);

  return (
    <>
      {hasMore && <div ref={sentinelRef} className="h-px" />}
      {loadingMore && <TableFooterNote>Yükleniyor…</TableFooterNote>}
      {!hasMore && itemCount > 0 && (
        <TableFooterNote>
          {formatNumber(itemCount)} {itemNoun} listelendi
        </TableFooterNote>
      )}
    </>
  );
}
