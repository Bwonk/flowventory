/**
 * Merchant timezone yardımcıları.
 *
 * Sorun: tarih/saat bucket'laması bazı yerlerde UTC (`toISOString`), bazı
 * yerlerde sunucu yerel saati (`getHours`, `setHours`) ile yapılıyordu.
 * Aynı görüntülenme/sipariş farklı endpoint'lerde farklı günlere düşüyordu.
 *
 * Çözüm: TÜM gün/saat hesapları tek bir timezone'da yapılır.
 * ikas getMerchant merchant bazlı TZ vermiyor; şimdilik `MERCHANT_TIMEZONE`
 * env değişkeni (varsayılan Europe/Istanbul) tek kaynak. MerchantSettings
 * tablosu geldiğinde her fonksiyona merchant'ın TZ'si parametre olarak
 * geçilebilir — imzalar buna hazır.
 */

export const DEFAULT_MERCHANT_TIMEZONE = process.env.MERCHANT_TIMEZONE || 'Europe/Istanbul';

type DateLike = Date | number;

function toDate(input: DateLike): Date {
  return typeof input === 'number' ? new Date(input) : input;
}

/** Verilen anın, verilen TZ'deki "YYYY-MM-DD" tarih anahtarı. */
export function dateKeyInTz(input: DateLike, timeZone: string = DEFAULT_MERCHANT_TIMEZONE): string {
  // en-CA locale'i YYYY-MM-DD formatı üretir.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(input));
}

/** Verilen anın, verilen TZ'deki saati (0-23). */
export function hourInTz(input: DateLike, timeZone: string = DEFAULT_MERCHANT_TIMEZONE): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(toDate(input));
  return Number(formatted);
}

/** Bir UTC anında TZ'nin UTC'ye göre ofseti (ms). UTC+3 için +3 saat döner. */
function tzOffsetMs(atMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(atMs));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - atMs;
}

/** "YYYY-MM-DD" gününün, verilen TZ'deki gece yarısının UTC epoch ms değeri. */
function dayStartMsInTz(dateKey: string, timeZone: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d);
  // Ofset DST ile değişebilir; tahmini anın ofsetiyle bir kez rafine et.
  let startMs = utcGuess - tzOffsetMs(utcGuess, timeZone);
  const refined = utcGuess - tzOffsetMs(startMs, timeZone);
  if (refined !== startMs) startMs = refined;
  return startMs;
}

/**
 * "YYYY-MM-DD" gününün TZ'deki [gün başı, gün sonu] UTC epoch aralığı (ms).
 * Gün sonu = ertesi günün başlangıcı - 1ms (DST'li 23/25 saatlik günlerde de doğru).
 */
export function dayRangeInTz(
  dateKey: string,
  timeZone: string = DEFAULT_MERCHANT_TIMEZONE,
): { startMs: number; endMs: number } {
  const startMs = dayStartMsInTz(dateKey, timeZone);
  // Ertesi günü, gün ortasından (start + 36h güvenli nokta) türet.
  const nextKey = dateKeyInTz(startMs + 36 * 60 * 60 * 1000, timeZone);
  const endMs = dayStartMsInTz(nextKey, timeZone) - 1;
  return { startMs, endMs };
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Verilen anın, verilen TZ'deki haftanın günü (0=Pazar … 6=Cumartesi, `Date#getDay` ile aynı). */
export function weekdayInTz(input: DateLike, timeZone: string = DEFAULT_MERCHANT_TIMEZONE): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(toDate(input));
  return WEEKDAY_INDEX[short];
}

/** "YYYY-MM-DD" anahtarını takvim günü olarak kaydırır (TZ'den bağımsız). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
