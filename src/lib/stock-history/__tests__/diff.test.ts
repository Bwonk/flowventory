import { describe, expect, it } from 'vitest';
import { diffStockRows, indexStockRows } from '@/lib/stock-history/diff';

const prev = indexStockRows([
  { productId: 'p1', variantId: 'v1', totalStock: 10 },
  { productId: 'p1', variantId: 'v2', totalStock: 0 },
]);

describe('diffStockRows', () => {
  it('yeni varyantı baseline olarak yazar', () => {
    const entries = diffStockRows(prev, [{ productId: 'p2', variantId: 'v9', totalStock: 3 }], 'sync');
    expect(entries).toEqual([{ productId: 'p2', variantId: 'v9', totalStock: 3, source: 'baseline' }]);
  });

  it('değişen stoğu verilen kaynakla yazar, aynı olanı atlar', () => {
    const entries = diffStockRows(
      prev,
      [
        { productId: 'p1', variantId: 'v1', totalStock: 7 },
        { productId: 'p1', variantId: 'v2', totalStock: 0 },
      ],
      'refresh',
    );
    expect(entries).toEqual([{ productId: 'p1', variantId: 'v1', totalStock: 7, source: 'refresh' }]);
  });

  it('silinen varyant için kayıt üretmez', () => {
    expect(diffStockRows(prev, [], 'sync')).toEqual([]);
  });

  it('boş snapshot ile hepsini baseline yazar', () => {
    const entries = diffStockRows(new Map(), [
      { productId: 'p1', variantId: 'v1', totalStock: 1 },
      { productId: 'p1', variantId: 'v2', totalStock: 2 },
    ], 'sync');
    expect(entries.map(e => e.source)).toEqual(['baseline', 'baseline']);
  });
});
