import { DEFAULT_LOCALE } from '@/lib/format';

/**
 * Belge (PDF, yazdırma, e-posta) biçimlendiricileri — saf, istemci ve sunucu
 * ortak kullanır.
 *
 * Tutarlar Türk ticari belgelerindeki gibi "21.950,00 TL" yazılır: Geist'te ₺
 * glifi yok (PDF'te boş kutu çıkar) ve sipariş formunda TL kısaltması zaten
 * yerleşik kullanım. TRY dışı para birimleri kodla yazılır ("1.200,00 EUR").
 */

const amount = new Intl.NumberFormat(DEFAULT_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function currencySuffix(currencyCode: string): string {
  return currencyCode.toUpperCase() === 'TRY' ? 'TL' : currencyCode.toUpperCase();
}

export function docMoney(value: number, currencyCode: string): string {
  return `${amount.format(value)} ${currencySuffix(currencyCode)}`;
}

/** Ondalıksız özet tutarı (KPI, e-posta özeti). */
export function docMoneyRounded(value: number, currencyCode: string): string {
  return `${Math.round(value).toLocaleString(DEFAULT_LOCALE)} ${currencySuffix(currencyCode)}`;
}

export function docNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(DEFAULT_LOCALE, { maximumFractionDigits });
}

/** "28 Eylül 2026" — mağaza saat diliminde. */
export function docDate(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(DEFAULT_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone });
}

/** "5 Eki" — dar alanlar (e-posta özeti). */
export function docShortDate(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(DEFAULT_LOCALE, { day: 'numeric', month: 'short', timeZone });
}

/** "28 Eyl 2026 · 16:26" */
export function docDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(DEFAULT_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  const time = d.toLocaleTimeString(DEFAULT_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone });
  return `${date} · ${time}`;
}

/** Adet koli katıysa "3 koli × 10"; değilse (ya da koli 1) boş. */
export function packLabel(qty: number, casePack: number | null): string | null {
  if (!casePack || casePack <= 1 || qty % casePack !== 0) return null;
  return `${qty / casePack} koli × ${casePack}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
