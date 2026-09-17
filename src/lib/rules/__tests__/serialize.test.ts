import { describe, expect, it } from 'vitest';
import { parseActionResults, parseWorkflow, ruleDataFromInput, toEventItem, toRuleItem } from '@/lib/rules/serialize';

const workflow = {
  stages: [
    {
      conditions: [
        { op: 'or', condition: { metric: 'stock_below', threshold: 5 } },
        { op: 'or', condition: { metric: 'no_sales', windowHours: 720 } },
      ],
      actions: [{ type: 'email' }],
    },
  ],
};

const row = {
  id: 'r1',
  name: 'Test',
  enabled: true,
  scope: 'all',
  targetId: null,
  targetLabel: null,
  granularity: 'product',
  workflowJson: JSON.stringify(workflow),
  cooldownHours: 168,
  resetHours: 168,
  maxRunsPerDay: 1,
  lastTriggeredAt: null,
  createdAt: new Date('2026-09-16T00:00:00Z'),
};

describe('toRuleItem', () => {
  it('workflow\'u çözümler, cümle ve aksiyon özetini üretir', () => {
    const item = toRuleItem(row);
    expect(item.workflow.stages).toHaveLength(1);
    expect(item.sentence).toBe('Tüm ürünler için stok 5 adedin altına inerse ya da 30 gün boyunca satış olmazsa: e-posta gönder.');
    expect(item.actionSummary).toBe('E-posta');
    expect(item.actionTypes).toEqual(['email']);
  });
  it('bozuk JSON → aşamasız, "Koşullar okunamadı"', () => {
    const item = toRuleItem({ ...row, workflowJson: '{nope' });
    expect(item.workflow).toEqual({ stages: [] });
    expect(item.sentence).toBe('Koşullar okunamadı');
  });
  it('bozuk enum alanında güvenli varsayılana düşer', () => {
    const item = toRuleItem({ ...row, granularity: 'sku' });
    expect(item.granularity).toBe('product');
    expect(item.workflow.stages).toEqual([]);
  });
});

describe('parseWorkflow', () => {
  it('migration çıktısını (v2 → tek aşama) okur, fazla alanı atar', () => {
    const migrated = {
      stages: [
        {
          conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 5, windowHours: 24 } }],
          actions: [{ type: 'notify' }],
        },
      ],
    };
    expect(parseWorkflow(JSON.stringify(migrated)).stages[0].conditions[0].condition).toEqual({ metric: 'stock_below', threshold: 5 });
  });
  it('aşama 1\'de "aşamadan beri" koşulu → okunamaz', () => {
    const bad = { stages: [{ conditions: [{ op: 'and', condition: { metric: 'sales_since_stage', threshold: 2 } }], actions: [{ type: 'notify' }] }] };
    expect(parseWorkflow(JSON.stringify(bad))).toEqual({ stages: [] });
  });
});

describe('event sonuçları', () => {
  it('actionsJson bozuk öğeleri atlar', () => {
    const json = JSON.stringify([{ type: 'notify', ok: true, detail: 'Zile düştü' }, { type: 'sms', ok: true }, null]);
    expect(parseActionResults(json)).toEqual([{ type: 'notify', ok: true, detail: 'Zile düştü' }]);
    expect(parseActionResults('{')).toEqual([]);
  });
  it('toEventItem', () => {
    const item = toEventItem({
      id: 'e1', productId: 'p1', variantId: 'v1', productName: 'P · M', stageIndex: 1, body: 'b',
      actionsJson: '[]', createdAt: new Date('2026-09-16T00:00:00Z'),
    });
    expect(item).toMatchObject({ variantId: 'v1', stageIndex: 1, actions: [] });
  });
});

describe('ruleDataFromInput', () => {
  it('kapsam all ise hedefi temizler, workflow\'u JSON yapar, onayı saklamaz', () => {
    const data = ruleDataFromInput({
      name: 'X', scope: 'all', targetId: 'p1', targetLabel: 'P', granularity: 'product',
      workflow: { stages: [{ conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 5 } }], actions: [{ type: 'notify' }] }] },
      cooldownHours: 24, resetHours: 168, maxRunsPerDay: 1, enabled: true, stockWriteConsent: true,
    });
    expect(data.targetId).toBeNull();
    expect(data.workflowJson).toBe('{"stages":[{"conditions":[{"op":"and","condition":{"metric":"stock_below","threshold":5}}],"actions":[{"type":"notify"}]}]}');
    expect('stockWriteConsent' in data).toBe(false);
  });
});
