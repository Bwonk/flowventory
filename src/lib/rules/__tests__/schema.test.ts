import { describe, expect, it } from 'vitest';
import { ruleInputSchema, storedWorkflowSchema } from '@/lib/rules/schema';

const stage = (conditions: unknown[], actions: unknown[] = [{ type: 'notify' }]) => ({
  conditions: conditions.map(condition => ({ op: 'and', condition })),
  actions,
});

const valid = {
  name: 'Test',
  scope: 'all',
  cooldownHours: 24,
  workflow: { stages: [stage([{ metric: 'stock_drop', threshold: 5, thresholdUnit: 'units', windowHours: 24 }])] },
};

const firstMessage = (body: unknown) => {
  const r = ruleInputSchema.safeParse(body);
  return r.success ? null : r.error.issues[0]?.message;
};

describe('ruleInputSchema', () => {
  it('geçerli gövdeyi varsayılanlarla kabul eder', () => {
    const r = ruleInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.enabled).toBe(true);
      expect(r.data.granularity).toBe('product');
      expect(r.data.resetHours).toBe(168);
      expect(r.data.maxRunsPerDay).toBe(1);
    }
  });
  it('kapsam ürün/tedarikçi ise hedef ister', () => {
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product' }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, scope: 'product', targetId: 'p1' }).success).toBe(true);
  });
  it('farklı alanlardan koşullar bir kuralda karışabilir', () => {
    const mixed = stage([{ metric: 'stock_below', threshold: 5 }, { metric: 'abc_class_is', value: 'A' }, { metric: 'reorder_point_reached' }]);
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [mixed] } }).success).toBe(true);
  });
  it('aşama 1..3, koşul 1..5, aksiyon 1..4', () => {
    const s = valid.workflow.stages[0];
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [] } }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [s, s, s] } }).success).toBe(true);
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [s, s, s, s] } }).success).toBe(false);
    expect(firstMessage({ ...valid, workflow: { stages: [stage([])] } })).toBe('Her aşamada en az bir koşul olmalı');
    const six = Array.from({ length: 6 }, () => ({ metric: 'stock_below', threshold: 5 }));
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [stage(six)] } }).success).toBe(false);
    expect(firstMessage({ ...valid, workflow: { stages: [stage([{ metric: 'stock_below', threshold: 5 }], [])] } })).toBe(
      'Her aşamada en az bir aksiyon olmalı',
    );
  });
  it('aynı aksiyon bir aşamada iki kez olamaz', () => {
    const dup = stage([{ metric: 'stock_below', threshold: 5 }], [{ type: 'notify' }, { type: 'notify' }]);
    expect(firstMessage({ ...valid, workflow: { stages: [dup] } })).toBe('"Bildirim gönder" bir aşamada bir kez kullanılabilir');
  });
  it('"aşamadan beri" koşulu aşama 1\'de reddedilir, aşama 2\'de kabul', () => {
    const since = stage([{ metric: 'stock_drop_since_stage', threshold: 3 }], [{ type: 'email' }]);
    expect(firstMessage({ ...valid, workflow: { stages: [since] } })).toBe('"Stok daha da düştü" yalnız 2. aşamadan itibaren kullanılabilir');
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [valid.workflow.stages[0], since] } }).success).toBe(true);
  });
  it('stok aksiyonu varyant düzeyi ve onay ister', () => {
    const restock = { stages: [stage([{ metric: 'stock_below', threshold: 10 }], [{ type: 'adjust_stock', mode: 'increase', amount: 5 }])] };
    expect(firstMessage({ ...valid, workflow: restock, stockWriteConsent: true })).toBe('Stok aksiyonu varyant düzeyinde çalışır');
    expect(firstMessage({ ...valid, workflow: restock, granularity: 'variant' })).toBe('Stok aksiyonu için onay gerekli');
    expect(ruleInputSchema.safeParse({ ...valid, workflow: restock, granularity: 'variant', stockWriteConsent: true }).success).toBe(true);
  });
  it('stok artışı adım başına en fazla 1.000', () => {
    const big = { stages: [stage([{ metric: 'stock_below', threshold: 10 }], [{ type: 'adjust_stock', mode: 'increase', amount: 1001 }])] };
    expect(firstMessage({ ...valid, workflow: big, granularity: 'variant', stockWriteConsent: true })).toBe('Tek seferde en fazla +1.000 adet');
  });
  it('yüzde eşiği 1–100, enum değerleri ve pencereler doğrulanır', () => {
    const pct = stage([{ metric: 'stock_drop', threshold: 150, thresholdUnit: 'percent', windowHours: 24 }]);
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [pct] } }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, workflow: { stages: [stage([{ metric: 'abc_class_is', value: 'D' }])] } }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, cooldownHours: 12 }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, resetHours: 12 }).success).toBe(false);
    expect(ruleInputSchema.safeParse({ ...valid, maxRunsPerDay: 0 }).success).toBe(false);
  });
  it("bağlaç verilmezse VE varsayılır", () => {
    const r = ruleInputSchema.safeParse({
      ...valid,
      workflow: { stages: [{ conditions: [{ condition: { metric: 'stock_below', threshold: 5 } }], actions: [{ type: 'notify' }] }] },
    });
    expect(r.success && r.data.workflow.stages[0].conditions[0].op).toBe('and');
  });
});

describe('storedWorkflowSchema', () => {
  it('DB okumasında aynı aşama kurallarını uygular', () => {
    expect(storedWorkflowSchema.safeParse({ stages: [stage([{ metric: 'sales_since_stage', threshold: 3 }])] }).success).toBe(false);
    expect(storedWorkflowSchema.safeParse(valid.workflow).success).toBe(true);
  });
});
