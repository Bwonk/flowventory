import { describe, expect, it } from 'vitest';
import { deriveAction, overstockExcessValue, type ActionInput } from '@/lib/reports/actions';

const T = { targetStockDays: 30 };

function input(overrides: Partial<ActionInput>): ActionInput {
  return {
    abcClass: 'A',
    totalStock: 10,
    soldQty: 5,
    daysOfStock: 60,
    agingBucket: '31-60',
    stockoutBeforeLeadTime: false,
    ...overrides,
  };
}

describe('deriveAction — siparis-ver', () => {
  it('A sınıfı + tedarik süresinden önce tükenme → siparis-ver', () => {
    expect(deriveAction(input({ abcClass: 'A', stockoutBeforeLeadTime: true, daysOfStock: 5, agingBucket: '0-30' }), T)).toBe('siparis-ver');
  });

  it('B sınıfı da kuyruğa girer', () => {
    expect(deriveAction(input({ abcClass: 'B', stockoutBeforeLeadTime: true, daysOfStock: 3, agingBucket: '0-30' }), T)).toBe('siparis-ver');
  });

  it('C sınıfı tükenme siparis-ver DEĞİL', () => {
    expect(deriveAction(input({ abcClass: 'C', stockoutBeforeLeadTime: true, daysOfStock: 2, agingBucket: '0-30' }), T)).toBeNull();
  });

  it('stok 0 olan A ürün (tükendi) kuyruktadır', () => {
    expect(
      deriveAction(input({ abcClass: 'A', totalStock: 0, daysOfStock: 0, stockoutBeforeLeadTime: true, agingBucket: '0-30' }), T),
    ).toBe('siparis-ver');
  });
});

describe('deriveAction — eritme-adayi', () => {
  it('C + 180+ kova → eritme-adayi', () => {
    expect(deriveAction(input({ abcClass: 'C', agingBucket: '180+', daysOfStock: 200 }), T)).toBe('eritme-adayi');
  });

  it('C + satışsız + stok > 0 → eritme-adayi', () => {
    expect(
      deriveAction(input({ abcClass: 'C', agingBucket: 'satışsız', soldQty: 0, daysOfStock: null }), T),
    ).toBe('eritme-adayi');
  });

  it('C + 91-180 kova eritme DEĞİL', () => {
    expect(deriveAction(input({ abcClass: 'C', agingBucket: '91-180', daysOfStock: 120 }), T)).toBe('fazla-stok');
  });

  it('A + 180+ eritme DEĞİL (fazla-stok olur)', () => {
    expect(deriveAction(input({ abcClass: 'A', agingBucket: '180+', daysOfStock: 200 }), T)).toBe('fazla-stok');
  });

  it('stoksuz C ürünü eritmeye girmez', () => {
    expect(
      deriveAction(input({ abcClass: 'C', totalStock: 0, agingBucket: 'satışsız', soldQty: 0, daysOfStock: null }), T),
    ).toBeNull();
  });

  it('öncelik: C + 180+ hem eritme hem fazla-stok koşulunu sağlarsa eritme kazanır', () => {
    expect(deriveAction(input({ abcClass: 'C', agingBucket: '180+', daysOfStock: 300, soldQty: 2 }), T)).toBe('eritme-adayi');
  });
});

describe('deriveAction — fazla-stok', () => {
  it('sınırda (target×3) fazla-stok DEĞİL, bir gün üstü fazla-stok', () => {
    expect(deriveAction(input({ daysOfStock: 90, agingBucket: '61-90' }), T)).toBeNull();
    expect(deriveAction(input({ daysOfStock: 91, agingBucket: '91-180' }), T)).toBe('fazla-stok');
  });

  it('satışı olmayan ürün asla fazla-stok olmaz', () => {
    expect(deriveAction(input({ soldQty: 0, daysOfStock: null, agingBucket: 'satışsız' }), T)).toBeNull();
  });

  it('daysOfStock null ise fazla-stok olmaz', () => {
    expect(deriveAction(input({ daysOfStock: null, agingBucket: 'satışsız' }), T)).toBeNull();
  });
});

describe('overstockExcessValue', () => {
  it('hedefin ötesindeki payı orantılar: 1000₺, 120 gün, hedef 30 → 750', () => {
    expect(overstockExcessValue(1000, 120, 30)).toBe(750);
  });

  it('hedef altında ya da hedefte 0', () => {
    expect(overstockExcessValue(1000, 30, 30)).toBe(0);
    expect(overstockExcessValue(1000, 10, 30)).toBe(0);
  });
});
