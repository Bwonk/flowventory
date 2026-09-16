import { describe, expect, it } from 'vitest';
import { describeRule } from '@/lib/rules/describe';
import { ruleInputSchema } from '@/lib/rules/schema';

describe('describeRule', () => {
  it('kapsam + koşulu tek cümlede birleştirir', () => {
    expect(describeRule({ scope: 'all', targetId: null, targetLabel: null, metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 }))
      .toBe('Tüm ürünler için 24 saat içinde stok 50 adet düşerse');
    expect(describeRule({ scope: 'vendor', targetId: 'v1', targetLabel: 'Acme', metric: 'days_of_cover_below', threshold: 7, thresholdUnit: 'days', windowHours: 168 }))
      .toBe('Acme ürünlerinde stok ömrü 7 günün altına inerse');
    expect(describeRule({ scope: 'product', targetId: 'p1', targetLabel: 'Kırmızı Tişört', metric: 'no_sales', threshold: 0, thresholdUnit: 'units', windowHours: 720 }))
      .toBe('Kırmızı Tişört için 30 gün boyunca satış olmazsa');
    expect(describeRule({ scope: 'all', targetId: null, targetLabel: null, metric: 'stock_drop', threshold: 30, thresholdUnit: 'percent', windowHours: 48 }))
      .toBe('Tüm ürünler için 48 saat içinde stok %30 düşerse');
  });
});

describe('ruleInputSchema', () => {
  const valid = { name: 'Test', scope: 'all', metric: 'stock_drop', threshold: 5, thresholdUnit: 'units', windowHours: 24 };

  it('geçerli gövdeyi varsayılanlarla kabul eder', () => {
    const r = ruleInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(true);
  });
  it('kapsam ürün/tedarikçi ise hedef ister', () => {
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product' }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product', targetId: 'p1' }).success).toBe(true);
  });
  it('yüzde eşiği 1–100 aralığında', () => {
    expect(ruleInputSchema.safeParse({ ...valid, thresholdUnit: 'percent', threshold: 150 }).success).toBe(false);
  });
  it('stok ömrü metriği gün birimi ister', () => {
    expect(ruleInputSchema.safeParse({ ...valid, metric: 'days_of_cover_below', thresholdUnit: 'units' }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, metric: 'days_of_cover_below', thresholdUnit: 'days', threshold: 7 }).success).toBe(true);
  });
  it('bilinmeyen pencereyi reddeder', () => {
    expect(ruleInputSchema.safeParse({ ...valid, windowHours: 12 }).success).toBe(false);
  });
});
