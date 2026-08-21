/**
 * Sayı/para biçimlendirme — tek kaynak.
 *
 * Daha önce `₺${value.toLocaleString('tr-TR')}` kalıbı 4 ayrı dosyada
 * kopyalanmıştı (B11). ikas çok pazarlı: mağazanın para birimi sipariş ve
 * varyant fiyatlarında `currencyCode` olarak geliyor, sync bunu
 * MerchantSettings'e yazıyor. Buradaki fonksiyonlar o kodu alıp
 * `Intl.NumberFormat` ile biçimlendirir.
 *
 * Saf fonksiyonlar — React'e ve tarayıcıya bağımlı değil, test edilebilir.
 * Aktif para birimini okuyan sarmalayıcı için `@/lib/currency`.
 */

export const DEFAULT_LOCALE = 'tr-TR';
export const DEFAULT_CURRENCY = 'TRY';

/** ISO 4217 üç harfli kod. Geçersiz kod Intl'de RangeError atar; önce eleriz. */
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

export function isValidCurrencyCode(code: unknown): code is string {
  return typeof code === 'string' && CURRENCY_PATTERN.test(code);
}

/** Aynı (locale, currency) çifti için formatter'ı yeniden kurmayalım — tablolarda satır başına çağrılıyor. */
const moneyFormatters = new Map<string, { formatter: Intl.NumberFormat; isFallback: boolean }>();

function getMoneyFormatter(locale: string, currency: string, wholeNumber = false) {
  const key = `${locale}|${currency}|${wholeNumber ? 0 : 2}`;
  const cached = moneyFormatters.get(key);
  if (cached) return cached;

  const fractionDigits = wholeNumber ? 0 : 2;
  let entry: { formatter: Intl.NumberFormat; isFallback: boolean };
  try {
    entry = {
      formatter: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
      isFallback: false,
    };
  } catch {
    // Kod ISO listesinde yoksa para birimi stilinden vazgeçip kodu önek olarak yazarız.
    entry = {
      formatter: new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
      isFallback: true,
    };
  }
  moneyFormatters.set(key, entry);
  return entry;
}

/**
 * Para biçimi. `currencyCode` verilmezse/geçersizse `TRY` varsayılır —
 * mağaza para birimi henüz sync edilmemiş olabilir.
 *
 * @example formatMoney(1234.5)         → "₺1.234,50"
 * @example formatMoney(1234.5, 'USD')  → "$1.234,50"
 */
export function formatMoney(value: number, currencyCode?: string | null, locale: string = DEFAULT_LOCALE): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const currency = isValidCurrencyCode(currencyCode) ? currencyCode.toUpperCase() : DEFAULT_CURRENCY;
  const { formatter, isFallback } = getMoneyFormatter(locale, currency);
  const formatted = formatter.format(safeValue);
  return isFallback ? `${currency} ${formatted}` : formatted;
}

/**
 * Ondalıksız para biçimi — dar KPI karolarında kuruş göstermeye yer yok.
 * @example formatMoneyRounded(1234.5) → "₺1.235"
 */
export function formatMoneyRounded(value: number, currencyCode?: string | null, locale: string = DEFAULT_LOCALE): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const currency = isValidCurrencyCode(currencyCode) ? currencyCode.toUpperCase() : DEFAULT_CURRENCY;
  const { formatter, isFallback } = getMoneyFormatter(locale, currency, true);
  const formatted = formatter.format(safeValue);
  return isFallback ? `${currency} ${formatted}` : formatted;
}

/** Adet/sayaç biçimi — binlik ayraçlı, ondalıksız. */
export function formatNumber(value: number, locale: string = DEFAULT_LOCALE): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString(locale);
}

/** Oran (0–1) → "%12,3". */
export function formatPercent(ratio: number, maximumFractionDigits = 1, locale: string = DEFAULT_LOCALE): string {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `%${(safe * 100).toLocaleString(locale, { maximumFractionDigits })}`;
}

/** Tarih anahtarı: "2026-09-01". SalesDaily/ProductView bu formatta tutuluyor. */
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "2026-09-01" → "1 Eyl 2026".
 *
 * Anahtar zaten merchant timezone'unda üretildiği için burada UTC'de
 * biçimlendiriyoruz; aksi hâlde tarayıcının TZ'si günü bir kaydırabilir.
 *
 * @returns geçersiz anahtarda null — çağıran "—" gösterir.
 */
export function formatDateKey(key: string | null | undefined, locale: string = DEFAULT_LOCALE): string | null {
  if (typeof key !== 'string') return null;
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Bir varyant/sipariş listesindeki baskın para birimini seçer.
 * Karışık kodlarda en çok geçen kazanır; hiç yoksa null (çağıran varsayılana düşer).
 */
export function dominantCurrencyCode(codes: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const code of codes) {
    if (!isValidCurrencyCode(code)) continue;
    const upper = code.toUpperCase();
    counts.set(upper, (counts.get(upper) ?? 0) + 1);
  }
  let winner: string | null = null;
  let best = 0;
  for (const [code, count] of counts) {
    if (count > best) {
      winner = code;
      best = count;
    }
  }
  return winner;
}
