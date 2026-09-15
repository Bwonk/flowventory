'use client';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ScrollMode } from './types';

/** En yakın dikey kaydırıcı ata (dashboard'da `main[data-slot=sidebar-inset]`). */
export function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Sanal listenin kaydırıcısı ve tablonun ona göre üst boşluğu (`scrollMargin`);
 * tablonun kökten geniş olup olmadığı (yatay kaydırma anahtarı) ve yazdırma
 * durumu. Ölçümler kök + kaydırıcının doğrudan çocukları ResizeObserver'ıyla
 * tazelenir — tablonun üstündeki içerik boy değiştirince (filtre, KPI) kayma
 * olmaz. `beforeprint` senkron (`flushSync`) uygulanır ki Chrome kağıdı
 * çekmeden tüm satırlar DOM'a girsin.
 */
export function useScrollParent(rootRef: RefObject<HTMLDivElement | null>, mode: ScrollMode) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const [printing, setPrinting] = useState(false);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    setOverflowing(root.scrollWidth > root.clientWidth + 1);
    if (!scroller || mode === 'element') {
      setScrollMargin(0);
      return;
    }
    const margin = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScrollMargin(Math.max(0, Math.round(margin)));
  }, [rootRef, scroller, mode]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setScroller(mode === 'element' ? root : findScrollParent(root));
  }, [rootRef, mode]);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    // Tablo kolon resize'ında kök değil tablo genişler — yatay kaydırma anahtarı bunu izler.
    if (root.firstElementChild) observer.observe(root.firstElementChild);
    if (scroller && scroller !== root) {
      for (const child of Array.from(scroller.children)) observer.observe(child);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, rootRef, scroller]);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  return { scroller, scrollMargin, overflowing, printing, measure };
}
