import { describe, expect, it } from 'vitest';
import {
  evaluateCriticalStock,
  evaluateDeadStock,
  evaluateSalesSpike,
} from '@/lib/alerts/rules';

const product = {
  productId: 'p1',
  productName: 'Test Ürün',
  minStock: 0,
  totalStock: 10,
  soldQtyWindow: 5,
};

describe('evaluateCriticalStock', () => {
  it('stok tükendiğinde bildirim üretir', () => {
    const alert = evaluateCriticalStock({ ...product, minStock: 0 }, 5, '2026-08-11');
    expect(alert?.type).toBe('critical-stock');
    expect(alert?.title).toBe('Test Ürün stoğu tükendi');
    expect(alert?.dedupeKey).toBe('critical-stock:p1:2026-08-11');
  });

  it('eşik altında bildirim üretir', () => {
    const alert = evaluateCriticalStock({ ...product, minStock: 3 }, 5, '2026-08-11');
    expect(alert?.title).toBe('Test Ürün kritik stok seviyesinde');
  });

  it('eşik üstünde bildirim üretmez', () => {
    expect(evaluateCriticalStock({ ...product, minStock: 6 }, 5, '2026-08-11')).toBeNull();
  });
});

describe('evaluateDeadStock', () => {
  it('stoklu ama satışsız üründe bildirim üretir (haftalık dedupe)', () => {
    const alert = evaluateDeadStock({ ...product, totalStock: 10, soldQtyWindow: 0 }, 'w-2026-08-09');
    expect(alert?.type).toBe('dead-stock');
    expect(alert?.dedupeKey).toBe('dead-stock:p1:w-2026-08-09');
  });

  it('satışı olan üründe bildirim üretmez', () => {
    expect(evaluateDeadStock({ ...product, soldQtyWindow: 2 }, 'w-1')).toBeNull();
  });

  it('stoksuz üründe bildirim üretmez', () => {
    expect(evaluateDeadStock({ ...product, totalStock: 0, soldQtyWindow: 0 }, 'w-1')).toBeNull();
  });
});

describe('evaluateSalesSpike', () => {
  const p = { productId: 'p1', productName: 'Test Ürün' };

  it('ortalamanın 3 katı aşıldığında bildirim üretir', () => {
    // ort 2, bugün 7 → 7 > 6
    const alert = evaluateSalesSpike(p, 7, [2, 2, 2, 2, 2, 2, 2], '2026-08-11');
    expect(alert?.type).toBe('sales-spike');
  });

  it('3 kat aşılmadıysa bildirim üretmez', () => {
    expect(evaluateSalesSpike(p, 6, [2, 2, 2, 2, 2, 2, 2], '2026-08-11')).toBeNull();
  });

  it('minimum adet altında bildirim üretmez (gürültü koruması)', () => {
    // 4 adet: ortalamanın 4 katı ama SPIKE_MIN_UNITS=5 altı
    expect(evaluateSalesSpike(p, 4, [1, 1, 1, 1, 1, 1, 1], '2026-08-11')).toBeNull();
  });

  it('geçmişi olmayan üründe ilk yüksek satışı bildirir', () => {
    const alert = evaluateSalesSpike(p, 8, [], '2026-08-11');
    expect(alert?.type).toBe('sales-spike');
  });
});
