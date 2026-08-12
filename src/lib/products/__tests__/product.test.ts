import { describe, expect, it } from 'vitest';
import type { Product, Variant } from '@/lib/products/types';
import {
  getProductStatus,
  getTotalStock,
  getVariantStock,
  getVariantStockLocations,
} from '@/lib/products/product';

/**
 * B16 regresyonu: varyant stoğu tüm depoların toplamı olmalı.
 * Önceden yalnızca `stocks[0]` okunuyordu ve sync katmanıyla (tüm depoları
 * toplayan ProductSnapshot) çelişiyordu.
 */

type Stock = { stockCount: number; stockLocationId: string };

function variant(stocks: Stock[], id = 'v1'): Variant {
  return { id, stocks } as unknown as Variant;
}

function product(variants: Variant[]): Product {
  return { id: 'p1', name: 'Ürün', variants } as unknown as Product;
}

describe('getVariantStock', () => {
  it('tüm depoların stoğunu toplar', () => {
    expect(getVariantStock(variant([
      { stockCount: 3, stockLocationId: 'loc-1' },
      { stockCount: 7, stockLocationId: 'loc-2' },
    ]))).toBe(10);
  });

  it('tek depoda o deponun stoğunu döner', () => {
    expect(getVariantStock(variant([{ stockCount: 4, stockLocationId: 'loc-1' }]))).toBe(4);
  });

  it('depo yoksa 0 döner', () => {
    expect(getVariantStock(variant([]))).toBe(0);
    expect(getVariantStock({ id: 'v1' } as unknown as Variant)).toBe(0);
  });

  it('ilk deposu boş olsa da diğer depoları sayar (eski davranışta 0 dönerdi)', () => {
    expect(getVariantStock(variant([
      { stockCount: 0, stockLocationId: 'loc-1' },
      { stockCount: 12, stockLocationId: 'loc-2' },
    ]))).toBe(12);
  });
});

describe('getTotalStock', () => {
  it('varyantların çok depolu toplamlarını birleştirir', () => {
    const p = product([
      variant([{ stockCount: 2, stockLocationId: 'a' }, { stockCount: 3, stockLocationId: 'b' }], 'v1'),
      variant([{ stockCount: 5, stockLocationId: 'a' }], 'v2'),
    ]);
    expect(getTotalStock(p)).toBe(10);
  });
});

describe('getProductStatus', () => {
  it('ikinci depodaki stok sayesinde kritik sayılmaz', () => {
    const p = product([
      variant([{ stockCount: 0, stockLocationId: 'a' }, { stockCount: 50, stockLocationId: 'b' }]),
    ]);
    expect(getProductStatus(p, 5, 10)).toBe('healthy');
  });

  it('toplam eşik altındaysa kritik döner', () => {
    const p = product([
      variant([{ stockCount: 1, stockLocationId: 'a' }, { stockCount: 2, stockLocationId: 'b' }]),
    ]);
    expect(getProductStatus(p, 5, 10)).toBe('critical');
  });
});

describe('getVariantStockLocations', () => {
  it('depo bazlı dağılımı döner', () => {
    expect(getVariantStockLocations(variant([
      { stockCount: 3, stockLocationId: 'loc-1' },
      { stockCount: 7, stockLocationId: 'loc-2' },
    ]))).toEqual([
      { stockLocationId: 'loc-1', stockCount: 3 },
      { stockLocationId: 'loc-2', stockCount: 7 },
    ]);
  });

  it('stockLocationId olmayan kayıtları eler (o depoya yazılamaz)', () => {
    const v = { id: 'v1', stocks: [{ stockCount: 5 }, { stockCount: 2, stockLocationId: 'loc-2' }] } as unknown as Variant;
    expect(getVariantStockLocations(v)).toEqual([{ stockLocationId: 'loc-2', stockCount: 2 }]);
  });

  it('depo yoksa boş dizi döner', () => {
    expect(getVariantStockLocations(variant([]))).toEqual([]);
  });
});
