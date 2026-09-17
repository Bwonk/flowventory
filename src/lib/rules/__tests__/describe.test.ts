import { describe, expect, it } from 'vitest';
import { describeOutcome, describeRule, joinClauses } from '@/lib/rules/describe';
import { ruleInputSchema } from '@/lib/rules/schema';

describe('describeRule', () => {
  it('kapsam + koşulları tek cümlede birleştirir', () => {
    expect(describeRule({ scope: 'all', targetLabel: null, logic: 'and', conditions: [{ metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 }] }))
      .toBe('Tüm ürünler için 24 saat içinde stok 50 adet düşerse');
    expect(describeRule({
      scope: 'vendor', targetLabel: 'Acme', logic: 'or',
      conditions: [{ metric: 'reorder_point_reached' }, { metric: 'below_safety_stock' }],
    })).toBe('Acme ürünlerinde yeniden sipariş noktasına gelirse ya da emniyet stoğunun altına inerse');
    expect(describeRule({
      scope: 'product', targetLabel: 'Kırmızı Tişört', logic: 'and',
      conditions: [{ metric: 'abc_class_is', value: 'C' }, { metric: 'aging_bucket_is', value: '180+' }, { metric: 'no_sales', windowHours: 720 }],
    })).toBe('Kırmızı Tişört için ABC sınıfı C ise, yaşlandırma 180+ gün ise ve 30 gün boyunca satış olmazsa');
  });
  it('koşulsuz kuralı açıkça söyler', () => {
    expect(describeRule({ scope: 'all', targetLabel: null, logic: 'and', conditions: [] })).toBe('Tüm ürünler için koşul tanımlanmadı');
  });
});

describe('joinClauses', () => {
  it('1/2/3 koşul, ve / ya da', () => {
    expect(joinClauses(['A'], 'and')).toBe('A');
    expect(joinClauses(['A', 'B'], 'and')).toBe('A ve B');
    expect(joinClauses(['A', 'B', 'C'], 'or')).toBe('A, B ya da C');
  });
});

describe('describeOutcome', () => {
  it('kanal + aralık', () => {
    expect(describeOutcome({ channel: 'notification', cooldownHours: 24 })).toBe('Bildirim zilde · aynı ürün için en fazla 24 saatte bir');
    expect(describeOutcome({ channel: 'email', cooldownHours: 168 })).toBe('E-posta gönderilir · aynı ürün için en fazla 7 günde bir');
  });
});

describe('ruleInputSchema', () => {
  const valid = {
    name: 'Test', domain: 'stok', channel: 'notification', logic: 'and', scope: 'all', cooldownHours: 24,
    conditions: [{ metric: 'stock_drop', threshold: 5, thresholdUnit: 'units', windowHours: 24 }],
  };

  it('geçerli gövdeyi varsayılanlarla kabul eder', () => {
    const r = ruleInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(true);
  });
  it('kapsam ürün/tedarikçi ise hedef ister', () => {
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product' }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product', targetId: 'p1' }).success).toBe(true);
  });
  it('alan dışı metriği reddeder', () => {
    const r = ruleInputSchema.safeParse({ ...valid, domain: 'analiz' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain('bu alanda kullanılamaz');
  });
  it('en az 1, en fazla 5 koşul', () => {
    expect(ruleInputSchema.safeParse({ ...valid, conditions: [] }).success).toBe(false);
    const six = Array.from({ length: 6 }, () => ({ metric: 'stock_below', threshold: 5 }));
    expect(ruleInputSchema.safeParse({ ...valid, conditions: six }).success).toBe(false);
  });
  it('yüzde eşiği 1–100, enum değerleri doğrulanır', () => {
    expect(ruleInputSchema.safeParse({ ...valid, conditions: [{ metric: 'stock_drop', threshold: 150, thresholdUnit: 'percent', windowHours: 24 }] }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, domain: 'analiz', conditions: [{ metric: 'abc_class_is', value: 'D' }] }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, domain: 'analiz', conditions: [{ metric: 'abc_class_is', value: 'A' }] }).success).toBe(true);
  });
  it('bilinmeyen pencere ve kanalı reddeder', () => {
    expect(ruleInputSchema.safeParse({ ...valid, cooldownHours: 12 }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, channel: 'sms' }).success).toBe(false);
  });
});
