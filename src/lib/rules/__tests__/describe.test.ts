import { describe, expect, it } from 'vitest';
import { describeActionSummary, describeCadence, describeRule, describeStage } from '@/lib/rules/describe';
import type { RuleWorkflow } from '@/lib/rules/types';

const escalate: RuleWorkflow = {
  stages: [
    {
      conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 10 } }],
      actions: [{ type: 'notify' }, { type: 'adjust_stock', mode: 'increase', amount: 5 }],
    },
    {
      conditions: [{ op: 'and', condition: { metric: 'stock_drop_since_stage', threshold: 3 } }],
      actions: [{ type: 'email' }],
    },
  ],
};

describe('describeRule', () => {
  it('çok aşamalı cümle: kapsam, aşamalar "Sonra" ile', () => {
    expect(describeRule({ scope: 'all', targetLabel: null, workflow: escalate })).toBe(
      'Tüm ürünler için stok 10 adedin altına inerse: bildirim gönder ve stoğu 5 artır. Sonra stok 3 adet daha düşerse: e-posta gönder.',
    );
  });
  it('koşul başına bağlaç, VE önceliğiyle', () => {
    const workflow: RuleWorkflow = {
      stages: [
        {
          conditions: [
            { op: 'and', condition: { metric: 'reorder_point_reached' } },
            { op: 'and', condition: { metric: 'abc_class_is', value: 'A' } },
            { op: 'or', condition: { metric: 'below_safety_stock' } },
          ],
          actions: [{ type: 'email' }],
        },
      ],
    };
    expect(describeRule({ scope: 'vendor', targetLabel: 'Acme', workflow })).toBe(
      'Acme ürünlerinde yeniden sipariş noktasına gelirse ve ABC sınıfı A ise ya da emniyet stoğunun altına inerse: e-posta gönder.',
    );
  });
  it('koşulsuz kuralı açıkça söyler', () => {
    expect(describeRule({ scope: 'product', targetLabel: 'Tişört', workflow: { stages: [] } })).toBe('Tişört için koşul tanımlanmadı');
  });
});

describe('describeStage', () => {
  it('aksiyonsuz aşama', () => {
    expect(describeStage({ conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 5 } }], actions: [] })).toBe(
      'stok 5 adedin altına inerse: aksiyon seçilmedi.',
    );
  });
});

describe('describeActionSummary', () => {
  it('aşamalar boyunca tekrarsız kısa etiketler', () => {
    expect(describeActionSummary(escalate)).toBe('Bildirim · Stok +5 · E-posta');
    const twiceNotify: RuleWorkflow = { stages: [escalate.stages[0], { ...escalate.stages[1], actions: [{ type: 'notify' }] }] };
    expect(describeActionSummary(twiceNotify)).toBe('Bildirim · Stok +5');
  });
});

describe('describeCadence', () => {
  it('birim + aralık', () => {
    expect(describeCadence({ cooldownHours: 24, granularity: 'product' })).toBe('aynı ürün için en fazla 24 saatte bir');
    expect(describeCadence({ cooldownHours: 168, granularity: 'variant' })).toBe('aynı varyant için en fazla 7 günde bir');
  });
});
