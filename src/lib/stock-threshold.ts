import { useCallback, useEffect, useState } from 'react';

/**
 * Stok eşiği ayarı (mağaza geneli, kullanıcı tarafından ayarlanır).
 * - `min`: kritik eşiği — stok 1..min arası "Kritik" sayılır.
 * - `max`: az kalan eşiği — stok min+1..max arası "Az Kalan" sayılır.
 * Stok 0 ise "Tükendi", max üzeri ise "Sağlıklı".
 */
export interface StockThreshold {
  min: number;
  max: number;
}

export const DEFAULT_STOCK_THRESHOLD: StockThreshold = { min: 5, max: 10 };

const STORAGE_KEY = 'flowventory:stock-threshold';
const CHANGE_EVENT = 'flowventory:stock-threshold-change';

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

/** min ≤ max ve her ikisi de ≥ 0 olacak şekilde normalize eder. */
export function normalizeThreshold(value: Partial<StockThreshold>): StockThreshold {
  const max = toInt(value.max, DEFAULT_STOCK_THRESHOLD.max);
  const min = toInt(value.min, DEFAULT_STOCK_THRESHOLD.min);
  return { min: Math.min(min, max), max };
}

/** localStorage'dan eşiği okur (SSR'da güvenli varsayılan döner). */
export function readStockThreshold(): StockThreshold {
  if (typeof window === 'undefined') return DEFAULT_STOCK_THRESHOLD;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STOCK_THRESHOLD;
    return normalizeThreshold(JSON.parse(raw) as Partial<StockThreshold>);
  } catch {
    return DEFAULT_STOCK_THRESHOLD;
  }
}

/**
 * Stok eşiği için paylaşımlı hook. Aynı sekmedeki tüm tüketiciler
 * (stok sayfası + dashboard) custom event ile; farklı sekmeler `storage`
 * event ile senkronize olur. Hydration uyuşmazlığını önlemek için ilk
 * render'da her zaman varsayılan değerle başlar, sonra effect'te okur.
 */
export function useStockThreshold(): {
  threshold: StockThreshold;
  setThreshold: (value: Partial<StockThreshold>) => void;
} {
  const [threshold, setState] = useState<StockThreshold>(DEFAULT_STOCK_THRESHOLD);

  useEffect(() => {
    setState(readStockThreshold());
    const sync = () => setState(readStockThreshold());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setThreshold = useCallback((value: Partial<StockThreshold>) => {
    setState(prev => {
      const next = normalizeThreshold({ ...prev, ...value });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      }
      return next;
    });
  }, []);

  return { threshold, setThreshold };
}
