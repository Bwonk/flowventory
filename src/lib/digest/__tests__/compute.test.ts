import { describe, expect, it } from 'vitest';
import { computeDigest, type DigestInput, type DigestSnapshotRow } from '@/lib/digest/compute';

const snap = (over: Partial<DigestSnapshotRow> & Pick<DigestSnapshotRow, 'productId' | 'variantId'>): DigestSnapshotRow => ({
  productName: `Ürün ${over.productId}`,
  totalStock: 20,
  sellPrice: 100,
  buyPrice: 60,
  ...over,
});

const base: DigestInput = {
  frequency: 'weekly',
  ranges: {
    current: { start: '2026-08-31', end: '2026-09-06' },
    previous: { start: '2026-08-24', end: '2026-08-30' },
  },
  deadStockWindow: { start: '2026-08-09', end: '2026-09-07' },
  warningThreshold: 10,
  snapshots: [],
  sales: [],
  purchase: { lineCount: 0, urgentCount: 0, totalCost: 0, hasEstimate: false },
};

describe('computeDigest — satış', () => {
  it('dönem ve önceki dönem toplamlarını ayırır, dışarıdaki günleri saymaz', () => {
    const result = computeDigest({
      ...base,
      snapshots: [snap({ productId: 'p1', variantId: 'v1' })],
      sales: [
        { variantId: 'v1', date: '2026-09-01', quantity: 3, revenue: 300 },
        { variantId: 'v1', date: '2026-09-06', quantity: 1, revenue: 100 },
        { variantId: 'v1', date: '2026-08-25', quantity: 2, revenue: 200 },
        { variantId: 'v1', date: '2026-09-07', quantity: 9, revenue: 900 }, // bugün — dönem dışı
      ],
    });
    expect(result.sales).toEqual({
      revenue: 400,
      previousRevenue: 200,
      revenueDelta: 100,
      units: 4,
      previousUnits: 2,
      unitsDelta: 100,
    });
  });

  it('önceki dönem boşsa değişim null', () => {
    const result = computeDigest({
      ...base,
      snapshots: [snap({ productId: 'p1', variantId: 'v1' })],
      sales: [{ variantId: 'v1', date: '2026-09-01', quantity: 1, revenue: 50 }],
    });
    expect(result.sales.revenueDelta).toBeNull();
  });

  it('en çok satanları ürün bazında toplayıp ciroya göre sıralar', () => {
    const result = computeDigest({
      ...base,
      snapshots: [
        snap({ productId: 'p1', variantId: 'v1a' }),
        snap({ productId: 'p1', variantId: 'v1b' }),
        snap({ productId: 'p2', variantId: 'v2' }),
      ],
      sales: [
        { variantId: 'v1a', date: '2026-09-01', quantity: 1, revenue: 100 },
        { variantId: 'v1b', date: '2026-09-02', quantity: 2, revenue: 200 },
        { variantId: 'v2', date: '2026-09-03', quantity: 1, revenue: 250 },
      ],
    });
    expect(result.topProducts.map(p => [p.productId, p.revenue, p.units])).toEqual([
      ['p1', 300, 3],
      ['p2', 250, 1],
    ]);
  });
});

describe('computeDigest — stok', () => {
  it('tükenen ve az kalan ürünleri dashboard tanımıyla sayar', () => {
    const result = computeDigest({
      ...base,
      snapshots: [
        snap({ productId: 'out', variantId: 'a', totalStock: 0 }),
        snap({ productId: 'out', variantId: 'b', totalStock: 50 }),
        snap({ productId: 'low', variantId: 'c', totalStock: 4 }),
        snap({ productId: 'ok', variantId: 'd', totalStock: 11 }),
      ],
    });
    expect(result.stock.outOfStockCount).toBe(1);
    expect(result.stock.lowStockCount).toBe(1);
    expect(result.stock.lowest.map(p => [p.productId, p.minStock])).toEqual([
      ['out', 0],
      ['low', 4],
    ]);
  });
});

describe('computeDigest — ölü stok', () => {
  it('30 günde satışı olmayan stoklu ürünü ölü sayar, sermayeyi alış fiyatıyla hesaplar', () => {
    const result = computeDigest({
      ...base,
      snapshots: [
        snap({ productId: 'dead', variantId: 'v1', totalStock: 10, buyPrice: 40 }),
        snap({ productId: 'alive', variantId: 'v2', totalStock: 10 }),
      ],
      sales: [{ variantId: 'v2', date: '2026-09-05', quantity: 5, revenue: 500 }],
    });
    expect(result.deadStock).toEqual({ count: 1, lockedCapital: 400, isEstimate: false });
  });

  it('stok ömrü 180 günü aşan ürünü de ölü sayar; alış fiyatı yoksa tahmini işaretler', () => {
    const result = computeDigest({
      ...base,
      snapshots: [snap({ productId: 'slow', variantId: 'v1', totalStock: 200, buyPrice: null, sellPrice: 10 })],
      // 30 günde 1 adet → 200 adet ≈ 6000 gün
      sales: [{ variantId: 'v1', date: '2026-08-20', quantity: 1, revenue: 10 }],
    });
    expect(result.deadStock).toEqual({ count: 1, lockedCapital: 2000, isEstimate: true });
  });

  it('stoksuz ürünü ölü saymaz', () => {
    const result = computeDigest({
      ...base,
      snapshots: [snap({ productId: 'p', variantId: 'v', totalStock: 0 })],
    });
    expect(result.deadStock.count).toBe(0);
  });
});
