'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Sonsuz kaydırma sentinel'i: dönen ref bir boş div'e takılır; görünüme
 * yaklaşınca (300px marj) onLoadMore tetiklenir. İki tablodaki kopya
 * IntersectionObserver bloğunun tek kaynağı.
 */
export function useInfiniteScroll(
  hasMore: boolean,
  loadingMore: boolean,
  onLoadMore: () => void,
): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return sentinelRef;
}
