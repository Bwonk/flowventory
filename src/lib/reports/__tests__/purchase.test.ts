import { describe, expect, it } from 'vitest';
import { computePurchaseLine, roundUpToMultiple, stdDev } from '@/lib/reports/purchase';

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
