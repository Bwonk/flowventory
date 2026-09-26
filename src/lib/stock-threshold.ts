import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';

/**
 * Stok eşiği ayarı (mağaza geneli, kullanıcı tarafından ayarlanır).
 * - `min`: kritik eşiği — stok 1..min arası "Kritik" sayılır.
 * - `max`: az kalan eşiği — stok min+1..max arası "Az Kalan" sayılır.
 * Stok 0 ise "Tükendi", max üzeri ise "Sağlıklı".
 *
 * Kaynak hiyerarşisi:
 * 1. Sunucu (MerchantSettings tablosu) — tek doğru kaynak.
 * 2. localStorage — hızlı ilk boyama + sekmeler arası senkron cache'i.
 * Sunucudan gelen değer localStorage'a yazılır; değişiklik önce localStorage'a
 * (anında UI) sonra sunucuya gider. Sunucu yazımı başarısızsa değer geri
 * alınır ve `setThreshold` false döner — çağıran kullanıcıya bildirir.
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
/** Eşiği localStorage'a yazıp aynı sekmedeki dinleyicilere haber verir. */
function writeLocalThreshold(next: StockThreshold) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useStockThreshold(): {
  threshold: StockThreshold;
  /** localStorage okunduktan sonra true — ilk boyamadaki varsayılan-değer zıplamasını gizlemek için. */
  hydrated: boolean;
  /** İyimser uygular, sunucuya yazar; başarısızsa önceki değere döner ve false verir. */
  setThreshold: (value: Partial<StockThreshold>) => Promise<boolean>;
} {
  const [threshold, setState] = useState<StockThreshold>(DEFAULT_STOCK_THRESHOLD);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStockThreshold());
    setHydrated(true);
    const sync = () => setState(readStockThreshold());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);

    // Sunucudaki değeri çek — varsa cache'i ve state'i güncelle.
    let cancelled = false;
    (async () => {
      try {
        const token = await TokenHelpers.getTokenForIframeApp();
        if (!token || cancelled) return;
        const res = await ApiRequests.merchantSettings.get(token);
        const settings = res.data?.data;
        if (!settings || cancelled) return;
        const server = normalizeThreshold({
          min: settings.criticalThreshold,
          max: settings.warningThreshold,
        });
        const local = readStockThreshold();
        if (server.min !== local.min || server.max !== local.max) {
          writeLocalThreshold(server);
          setState(server);
        }
      } catch {
        // Sunucuya ulaşılamazsa cache/varsayılan ile devam.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Yan etki setState updater'ının DIŞINDA: StrictMode updater'ı iki kez
  // çağırıp iki istek atıyordu. Önceki değer localStorage cache'inden okunur
  // (her yazım oradan geçer; state ile aynı).
  const setThreshold = useCallback(async (value: Partial<StockThreshold>) => {
    const prev = readStockThreshold();
    const next = normalizeThreshold({ ...prev, ...value });
    writeLocalThreshold(next);
    setState(next);

    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) throw new Error('Missing iframe token');
      await ApiRequests.merchantSettings.update(token, {
        criticalThreshold: next.min,
        warningThreshold: next.max,
      });
      return true;
    } catch (error) {
      logger.error('Stok eşiği sunucuya kaydedilemedi', { error });
      // Sunucu tek doğru kaynak: yazılamayan değer bir sonraki açılışta sessizce
      // geri dönerdi — şimdi geri al. Bu arada daha yeni bir değer yazıldıysa ona dokunma.
      const current = readStockThreshold();
      if (current.min === next.min && current.max === next.max) {
        writeLocalThreshold(prev);
        setState(prev);
      }
      return false;
    }
  }, []);

  return { threshold, hydrated, setThreshold };
}
