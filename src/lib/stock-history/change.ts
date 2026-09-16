import type { StockRecord } from './types';

/**
 * Verilen anda (`at`) geçerli olan stok: `recordedAt <= at` olan en son kayıt.
 * Kayıtlar sıralı olmak zorunda değil. Hiç kayıt yoksa (baseline sonrası) null.
 */
export function pickStockAt(records: readonly StockRecord[], at: Date): number | null {
  let best: StockRecord | null = null;
  for (const r of records) {
    if (r.recordedAt.getTime() > at.getTime()) continue;
    if (!best || r.recordedAt.getTime() > best.recordedAt.getTime()) best = r;
  }
  return best ? best.totalStock : null;
}

export interface StockChange {
  delta: number | null;
  /** Yüzde değişim (−100…+∞); önceki değer 0 veya bilinmiyorsa null. */
  deltaPct: number | null;
}

/** Önceki ↔ mevcut stok farkı. Önceki bilinmiyorsa ikisi de null. */
export function computeStockChange(previous: number | null, current: number): StockChange {
  if (previous === null) return { delta: null, deltaPct: null };
  const delta = current - previous;
  const deltaPct = previous === 0 ? null : Math.round((delta / previous) * 1000) / 10;
  return { delta, deltaPct };
}

/**
 * Ürün toplamı için varyantların "önceki" değerlerini toplar.
 * Hepsi null → ürün pencere başında hiç izlenmiyordu → null.
 * Bir kısmı null → o varyantlar pencereden sonra doğmuş sayılır (0 katkı).
 */
export function sumProductPrevious(values: ReadonlyArray<number | null>): number | null {
  let sum = 0;
  let any = false;
  for (const v of values) {
    if (v === null) continue;
    any = true;
    sum += v;
  }
  return any ? sum : null;
}
