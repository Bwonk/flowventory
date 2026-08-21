import { useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { DEFAULT_CURRENCY, formatMoney, formatMoneyRounded, isValidCurrencyCode } from '@/lib/format';

/**
 * Mağazanın aktif para birimi (client tarafı).
 *
 * Kaynak hiyerarşisi — `stock-threshold` ile aynı desen:
 * 1. Sunucu (MerchantSettings.currencyCode) — tek doğru kaynak; sync sırasında
 *    ikas varyant fiyatlarındaki `currencyCode`'dan otomatik doldurulur.
 * 2. localStorage — hızlı ilk boyama cache'i.
 *
 * `formatPrice` modül seviyesindeki aktif kodu okur; böylece derin
 * component'lere (VariantCard, TrendChart…) prop geçirmek gerekmez.
 * Para birimi mağaza ömrü boyunca ~hiç değişmediğinden, sayfa seviyesinde
 * bir `useMerchantCurrency()` aboneliği tazelik için yeterli.
 */

const STORAGE_KEY = 'flowventory:currency';
const CHANGE_EVENT = 'flowventory:currency-change';

let activeCurrency: string | null = null;

function readStoredCurrency(): string {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValidCurrencyCode(raw) ? raw.toUpperCase() : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/** Aktif para birimi kodu — senkron, formatlama sırasında çağrılabilir. */
export function getActiveCurrency(): string {
  if (activeCurrency === null) activeCurrency = readStoredCurrency();
  return activeCurrency;
}

function setActiveCurrency(code: string) {
  const next = isValidCurrencyCode(code) ? code.toUpperCase() : DEFAULT_CURRENCY;
  if (next === getActiveCurrency()) return;
  activeCurrency = next;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Özel modda localStorage yazılamayabilir — bellekteki değerle devam.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Mağaza para birimiyle biçimlendirilmiş fiyat.
 * Eski `₺${value.toLocaleString('tr-TR')}` kalıbının yerini alır (B11).
 */
export function formatPrice(value: number): string {
  return formatMoney(value, getActiveCurrency());
}

/** Ondalıksız fiyat — dar KPI karoları için ("₺1.813.373"). */
export function formatPriceRounded(value: number): string {
  return formatMoneyRounded(value, getActiveCurrency());
}

/**
 * Para birimini sunucudan tazeler ve değiştiğinde yeniden render tetikler.
 * Sayfa bileşenlerinde (dashboard, stok, rapor, analiz) bir kez çağrılır.
 */
export function useMerchantCurrency(): string {
  // Hydration uyuşmazlığını önlemek için ilk render varsayılanla başlar.
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    setCurrency(getActiveCurrency());
    const sync = () => setCurrency(getActiveCurrency());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);

    let cancelled = false;
    (async () => {
      try {
        const token = await TokenHelpers.getTokenForIframeApp();
        if (!token || cancelled) return;
        const res = await ApiRequests.merchantSettings.get(token);
        const code = res.data?.data?.currencyCode;
        if (!code || cancelled) return;
        setActiveCurrency(code);
        setCurrency(getActiveCurrency());
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

  return currency;
}
