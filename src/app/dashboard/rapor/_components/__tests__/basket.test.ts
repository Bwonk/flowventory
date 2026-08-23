import { describe, expect, it } from 'vitest';
import {
  basketTotals,
  clampQty,
  defaultQtyFor,
  MAX_ORDER_QTY,
  seedBasket,
  vendorBasketLines,
  vendorBasketTotals,
} from '../basket';
import type {
  PurchaseReportApiResponse,
  PurchaseReportLine,
  PurchaseReportVendor,
} from '@/app/api/reports/purchase/route';

function makeLine(overrides: Partial<PurchaseReportLine>): PurchaseReportLine {
  return {
    variantId: 'v1',
    productId: 'p1',
    productName: 'Ürün',
    variantName: null,
    sku: null,
    imageUrl: null,
    currentStock: 0,
    dailyAvg: 1,
    safetyStock: 0,
    reorderPoint: 0,
    suggestedQty: 10,
    urgent: false,
    unitCost: 4,
    isEstimate: false,
    lineTotal: 40,
    needsOrder: true,
    ...overrides,
  };
}

function makeVendor(lines: PurchaseReportLine[], overrides?: Partial<PurchaseReportVendor>): PurchaseReportVendor {
  return { vendorId: 'ven1', vendorName: 'Tedarikçi', lines, totalCost: 0, hasEstimate: false, ...overrides };
}

const needs = makeLine({ variantId: 'a', suggestedQty: 15, unitCost: 2 });
const noNeeds = makeLine({ variantId: 'b', needsOrder: false, suggestedQty: 0, isEstimate: true, unitCost: 3 });

describe('clampQty', () => {
  it('1..MAX aralığına sıkıştırır ve yuvarlar', () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-5)).toBe(1);
    expect(clampQty(7.6)).toBe(8);
    expect(clampQty(MAX_ORDER_QTY + 1)).toBe(MAX_ORDER_QTY);
    expect(clampQty(Number.NaN)).toBe(1);
  });
});

describe('defaultQtyFor', () => {
  it('öneri satırında önerilen adedi, diğerlerinde 5 döner', () => {
    expect(defaultQtyFor(needs)).toBe(15);
    expect(defaultQtyFor(noNeeds)).toBe(5);
  });
});

describe('seedBasket', () => {
  it('yalnız needsOrder satırlarını önerilen adetle tohumlar', () => {
    const report = {
      vendors: [makeVendor([needs, noNeeds])],
    } as PurchaseReportApiResponse;
    expect(seedBasket(report)).toEqual({ a: 15 });
  });
});

describe('vendorBasketLines / vendorBasketTotals', () => {
  const vendor = makeVendor([needs, noNeeds]);
  const basket = { a: 15, b: 5 };

  it('sepetteki satırları rapor sırasıyla adetleriyle döner', () => {
    expect(vendorBasketLines(vendor, basket).map(({ line, qty }) => [line.variantId, qty])).toEqual([
      ['a', 15],
      ['b', 5],
    ]);
  });

  it('toplamları adet × birim üzerinden hesaplar, isEstimate bulaşır', () => {
    expect(vendorBasketTotals(vendor, basket)).toEqual({ count: 2, total: 15 * 2 + 5 * 3, hasEstimate: true });
  });

  it('boş sepette sıfır döner', () => {
    expect(vendorBasketTotals(vendor, {})).toEqual({ count: 0, total: 0, hasEstimate: false });
  });
});

describe('basketTotals', () => {
  it('tedarikçiler üzerinden birleştirir', () => {
    const vendors = [
      makeVendor([needs]),
      makeVendor([noNeeds], { vendorId: null, vendorName: 'Tedarikçi atanmamış' }),
    ];
    expect(basketTotals(vendors, { a: 10, b: 5 })).toEqual({ count: 2, total: 10 * 2 + 5 * 3, hasEstimate: true });
  });
});
