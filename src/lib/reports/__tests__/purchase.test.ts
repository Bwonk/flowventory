import { describe, expect, it } from 'vitest';
import { buildInStockMask, computePurchaseLine, computeReplenishment, roundUpToMultiple, stdDev } from '@/lib/reports/purchase';

describe('roundUpToMultiple', () => {
  it("5'in katına yukarı yuvarlar", () => {
    expect(roundUpToMultiple(1)).toBe(5);
    expect(roundUpToMultiple(5)).toBe(5);
    expect(roundUpToMultiple(6)).toBe(10);
    expect(roundUpToMultiple(23)).toBe(25);
  });

  it('sıfır ve negatifte 0 döner', () => {
    expect(roundUpToMultiple(0)).toBe(0);
    expect(roundUpToMultiple(-3)).toBe(0);
  });
});

describe('stdDev', () => {
  it('sabit seride 0 döner', () => {
    expect(stdDev([2, 2, 2, 2])).toBe(0);
  });

  it('bilinen seri için doğru hesaplar', () => {
    // [2,4,4,4,5,5,7,9] → popülasyon σ = 2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it('boş seride 0 döner', () => {
    expect(stdDev([])).toBe(0);
  });
});

describe('computePurchaseLine', () => {
  const steady = (qty: number, days = 30) => Array.from({ length: days }, () => qty);

  it('brief formülü: (günlük × (hedef + lead)) − stok, 5 katına yuvarlanır', () => {
    // günlük 2, hedef 30 + lead 7 → hedef seviye 74 (σ=0 → emniyet 0); stok 20 → 54 → 55
    const calc = computePurchaseLine({
      dailyQuantities: steady(2),
      currentStock: 20,
      leadTimeDays: 7,
      targetStockDays: 30,
    });
    expect(calc.dailyAvg).toBe(2);
    expect(calc.safetyStock).toBe(0);
    expect(calc.suggestedQty).toBe(55);
  });

  it('stok hedefin üzerindeyse öneri 0', () => {
    const calc = computePurchaseLine({
      dailyQuantities: steady(1),
      currentStock: 100,
      leadTimeDays: 7,
      targetStockDays: 30,
    });
    expect(calc.suggestedQty).toBe(0);
    expect(calc.urgent).toBe(false);
  });

  it('hiç satış yoksa öneri 0 ve acil değil', () => {
    const calc = computePurchaseLine({
      dailyQuantities: steady(0),
      currentStock: 0,
      leadTimeDays: 7,
      targetStockDays: 30,
    });
    expect(calc.suggestedQty).toBe(0);
    expect(calc.urgent).toBe(false);
  });

  it('dalgalı talep emniyet stoğunu artırır', () => {
    const flat = computePurchaseLine({
      dailyQuantities: steady(2),
      currentStock: 0,
      leadTimeDays: 9,
      targetStockDays: 30,
    });
    // Aynı ortalama (2), yüksek varyans: 15 gün 0, 15 gün 4
    const spiky = computePurchaseLine({
      dailyQuantities: [...steady(0, 15), ...steady(4, 15)],
      currentStock: 0,
      leadTimeDays: 9,
      targetStockDays: 30,
    });
    expect(spiky.dailyAvg).toBe(flat.dailyAvg);
    expect(spiky.safetyStock).toBeGreaterThan(flat.safetyStock);
    expect(spiky.reorderPoint).toBeGreaterThan(flat.reorderPoint);
  });

  it('stok reorder point altındaysa acil işaretlenir', () => {
    const calc = computePurchaseLine({
      dailyQuantities: steady(3),
      currentStock: 10, // reorderPoint = 3×7 = 21 > 10
      leadTimeDays: 7,
      targetStockDays: 30,
    });
    expect(calc.urgent).toBe(true);
  });
});

describe('computeReplenishment', () => {
  const steady = (qty: number, days = 30) => Array.from({ length: days }, () => qty);
  const base = { leadTimeDays: 10, targetStockDays: 30, incoming: 0, moq: null, casePack: 10 };

  it('sipariş noktasına inince öneri başlar, koliye yuvarlanır', () => {
    // günlük 1.2 (30 günde 36): ROP = 12, hedef = 48; stok 12 → ihtiyaç 36 → koli 10 → 40
    const calc = computeReplenishment({ ...base, dailyQuantities: [...steady(1, 24), ...steady(2, 6)], currentStock: 12 });
    expect(calc.dailyAvg).toBeCloseTo(1.2);
    expect(calc.needsOrder).toBe(true);
    expect(calc.suggestedQty % 10).toBe(0);
    expect(calc.suggestedQty).toBeGreaterThanOrEqual(calc.rawQty);
  });

  it('sipariş noktasının üstünde öneri yok ama ham ihtiyaç görünür', () => {
    const calc = computeReplenishment({ ...base, dailyQuantities: steady(1), currentStock: 25 });
    expect(calc.needsOrder).toBe(false);
    expect(calc.suggestedQty).toBe(0);
    expect(calc.rawQty).toBe(15);
  });

  it('yoldaki adet öneriden düşülür', () => {
    const without = computeReplenishment({ ...base, dailyQuantities: steady(2), currentStock: 10 });
    const withIncoming = computeReplenishment({ ...base, dailyQuantities: steady(2), currentStock: 10, incoming: 10 });
    expect(withIncoming.rawQty).toBe(without.rawQty - 10);
  });

  it('yoldaki adet sipariş noktasını geçiriyorsa öneri kalkar', () => {
    const calc = computeReplenishment({ ...base, dailyQuantities: steady(2), currentStock: 10, incoming: 60 });
    expect(calc.needsOrder).toBe(false);
  });

  it('MOQ ham ihtiyacın üstündeyse MOQ uygulanır', () => {
    const calc = computeReplenishment({ ...base, moq: 100, dailyQuantities: steady(1), currentStock: 5 });
    expect(calc.suggestedQty).toBe(100);
  });

  it('stoksuz günler ortalamaya girmez', () => {
    const qty = [...steady(0, 10), ...steady(3, 20)];
    const mask = [...Array(10).fill(false), ...Array(20).fill(true)];
    const calc = computeReplenishment({ ...base, dailyQuantities: qty, inStockMask: mask, currentStock: 0 });
    expect(calc.dailyAvg).toBe(3);
    expect(calc.inStockDays).toBe(20);
  });

  it('acil: stok + yolda tedarik süresini karşılamıyor', () => {
    const urgent = computeReplenishment({ ...base, dailyQuantities: steady(2), currentStock: 5 });
    expect(urgent.urgent).toBe(true);
    expect(urgent.orderInDays).toBeLessThanOrEqual(0);
  });

  it('satış yoksa kapsama ve en geç sipariş boş', () => {
    const calc = computeReplenishment({ ...base, dailyQuantities: steady(0), currentStock: 5 });
    expect(calc.daysOfCover).toBeNull();
    expect(calc.orderInDays).toBeNull();
    expect(calc.needsOrder).toBe(false);
  });
});

describe('buildInStockMask', () => {
  const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

  it('gün başında stok 0 ve satış yoksa günü dışarıda bırakır', () => {
    const history = [
      { dateKey: '2026-08-30', totalStock: 3 },
      { dateKey: '2026-09-01', totalStock: 0 },
      { dateKey: '2026-09-03', totalStock: 20 },
    ];
    // 01: başta 3 → stoklu; 02: başta 0, satış 0 → stoksuz; 03: başta 0 ama gün içinde geldi, satış 2 → stoklu; 04: 20
    expect(buildInStockMask(days, history, [1, 0, 2, 1])).toEqual([true, false, true, true]);
  });

  it('kayıt yoksa tüm günler dahil', () => {
    expect(buildInStockMask(days, [], [0, 0, 0, 0])).toEqual([true, true, true, true]);
  });
});
