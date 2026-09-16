/**
 * Stok Yolu hesapları — istemci ve sunucu ortak, saf.
 *
 * Kuram: uyarı ("5 stok kaldı") bir durum; karar için gereken zaman —
 * "bu stok beni kaç gün idare eder?". Buradaki fonksiyonlar geçmiş stok
 * serisini ve satış hızıyla ileriye projeksiyonu üretir.
 */

import { dayRangeInTz, shiftDateKey } from '@/lib/timezone';
import { pickStockAt } from './change';
import type { StockRecord } from './types';

export interface StockPoint {
  /** "YYYY-MM-DD" (merchant TZ gün anahtarı). */
  date: string;
  stock: number;
}

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

/**
 * Geçmiş stok serisi: [fromKey, toKey] aralığındaki her gün için gün sonu stoğu.
 * Kayıtlar varyant bazlı olabilir; gün toplamı varyantların o gündeki son
 * değerlerinin toplamıdır. Hiçbir varyantın kaydı olmayan günler (izleme
 * başlamadan öncesi) atlanır — grafik oradan başlar. Son gün (`toKey`)
 * `current` ile sabitlenir: snapshot ile geçmiş arasındaki gecikme görünmez.
 */
export function dailyStockSeries(
  records: readonly StockRecord[],
  fromKey: string,
  toKey: string,
  current: number,
  timeZone: string,
): StockPoint[] {
  const byVariant = new Map<string, StockRecord[]>();
  for (const r of records) {
    const list = byVariant.get(r.variantId) ?? [];
    list.push(r);
    byVariant.set(r.variantId, list);
  }

  const points: StockPoint[] = [];
  for (let key = fromKey; key < toKey; key = shiftDateKey(key, 1)) {
    const at = new Date(dayRangeInTz(key, timeZone).endMs);
    let sum = 0;
    let any = false;
    for (const list of byVariant.values()) {
      const v = pickStockAt(list, at);
      if (v === null) continue;
      any = true;
      sum += v;
    }
    if (any) points.push({ date: key, stock: sum });
  }
  points.push({ date: toKey, stock: current });
  return points;
}

export interface StockProjection {
  points: StockPoint[];
  /** Stoğun 0'a indiği gün; hız yoksa null, stok zaten yoksa bugün. */
  stockoutDate: string | null;
}

/**
 * Bugünden ileriye düz projeksiyon: her gün `velocity` kadar düşer, 0'da durur.
 * Hız yoksa düz çizgi (`maxDays` boyunca). Nokta sayısı en fazla maxDays+1.
 */
export function buildProjection(
  current: number,
  velocity: number,
  todayKey: string,
  maxDays: number = 90,
): StockProjection {
  const safeCurrent = Math.max(0, current);
  if (safeCurrent === 0) {
    return { points: [{ date: todayKey, stock: 0 }], stockoutDate: todayKey };
  }
  if (velocity <= 0) {
    return {
      points: [
        { date: todayKey, stock: safeCurrent },
        { date: shiftDateKey(todayKey, maxDays), stock: safeCurrent },
      ],
      stockoutDate: null,
    };
  }
  const daysToZero = Math.ceil(safeCurrent / velocity);
  const horizon = Math.min(daysToZero, maxDays);
  const points: StockPoint[] = [];
  for (let d = 0; d <= horizon; d++) {
    points.push({
      date: shiftDateKey(todayKey, d),
      stock: Math.max(0, Math.round((safeCurrent - velocity * d) * 10) / 10),
    });
  }
  return {
    points,
    stockoutDate: daysToZero <= maxDays ? shiftDateKey(todayKey, daysToZero) : null,
  };
}
