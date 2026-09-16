/**
 * Stok Yolu hesapları — istemci ve sunucu ortak, saf.
 *
 * Kuram: uyarı ("5 stok kaldı") bir durum; karar için gereken zaman —
 * "bu stok beni kaç gün idare eder?". Buradaki fonksiyonlar geçmiş stok
 * serisini ve satış hızıyla ileriye projeksiyonu üretir.
 */

/** 30 günlük satış adedinden günlük hız. */
export function velocityPerDay(soldQty30: number, windowDays: number = 30): number {
  if (windowDays <= 0 || soldQty30 <= 0) return 0;
  return soldQty30 / windowDays;
}

/**
 * Mevcut stok, günlük hızla kaç gün yeter.
 * Stok yoksa 0; hız yoksa (tahmin edilemez) null.
 */
export function daysOfCover(stock: number, velocity: number): number | null {
  if (stock <= 0) return 0;
  if (velocity <= 0) return null;
  return Math.round(stock / velocity);
}
