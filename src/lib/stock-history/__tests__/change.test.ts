import { describe, expect, it } from 'vitest';
import { computeStockChange, pickStockAt, sumProductPrevious } from '@/lib/stock-history/change';

const d = (iso: string) => new Date(iso);

describe('pickStockAt', () => {
  const records = [
    { variantId: 'v1', totalStock: 50, recordedAt: d('2026-09-01T10:00:00Z') },
    { variantId: 'v1', totalStock: 30, recordedAt: d('2026-09-05T10:00:00Z') },
    { variantId: 'v1', totalStock: 20, recordedAt: d('2026-09-10T10:00:00Z') },
  ];

  it('verilen andan önceki en son kaydı seçer (sırasız girdide de)', () => {
    expect(pickStockAt([...records].reverse(), d('2026-09-07T00:00:00Z'))).toBe(30);
  });

  it('tam o anda yazılan kaydı dahil eder', () => {
    expect(pickStockAt(records, d('2026-09-05T10:00:00Z'))).toBe(30);
  });

  it('ilk kayıttan önce null döner (baseline yok)', () => {
    expect(pickStockAt(records, d('2026-08-01T00:00:00Z'))).toBeNull();
  });
});

describe('computeStockChange', () => {
  it('önceki bilinmiyorsa ikisi de null', () => {
    expect(computeStockChange(null, 20)).toEqual({ delta: null, deltaPct: null });
  });

  it('düşüşü negatif delta ve yüzdeyle verir', () => {
    expect(computeStockChange(40, 28)).toEqual({ delta: -12, deltaPct: -30 });
  });

  it('önceki 0 ise yüzde null (bölme yok)', () => {
    expect(computeStockChange(0, 5)).toEqual({ delta: 5, deltaPct: null });
  });

  it('yüzdeyi bir ondalığa yuvarlar', () => {
    expect(computeStockChange(3, 4).deltaPct).toBe(33.3);
  });
});

describe('sumProductPrevious', () => {
  it('hepsi null → null', () => {
    expect(sumProductPrevious([null, null])).toBeNull();
  });

  it('kısmen null → null olanlar 0 sayılır', () => {
    expect(sumProductPrevious([10, null, 5])).toBe(15);
  });
});
