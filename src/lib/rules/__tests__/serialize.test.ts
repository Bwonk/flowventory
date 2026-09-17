import { describe, expect, it } from 'vitest';
import { parseConditions, ruleDataFromInput, toRuleItem } from '@/lib/rules/serialize';

const row = {
  id: 'r1',
  name: 'Test',
  enabled: true,
  scope: 'all',
  targetId: null,
  targetLabel: null,
  domain: 'stok',
  channel: 'email',
  logic: 'or',
  conditionsJson: JSON.stringify([{ metric: 'stock_below', threshold: 5 }, { metric: 'no_sales', windowHours: 720 }]),
  cooldownHours: 168,
  lastTriggeredAt: null,
  createdAt: new Date('2026-09-16T00:00:00Z'),
};

describe('toRuleItem', () => {
  it('koşulları çözümler, cümle ve sonucu üretir', () => {
    const item = toRuleItem(row);
    expect(item.conditions).toHaveLength(2);
    expect(item.sentence).toBe('Tüm ürünler için stok 5 adedin altına inerse ya da 30 gün boyunca satış olmazsa');
    expect(item.outcome).toBe('E-posta gönderilir · aynı ürün için en fazla 7 günde bir');
    expect(item.channel).toBe('email');
  });
  it('bozuk JSON → boş koşul, "Koşullar okunamadı"', () => {
    const item = toRuleItem({ ...row, conditionsJson: '{nope' });
    expect(item.conditions).toEqual([]);
    expect(item.sentence).toBe('Koşullar okunamadı');
  });
  it('bozuk enum alanında güvenli varsayılana düşer', () => {
    const item = toRuleItem({ ...row, channel: 'sms' });
    expect(item.channel).toBe('notification');
    expect(item.conditions).toEqual([]);
  });
});

describe('parseConditions', () => {
  it('migration çıktısını (windowHours fazladan) kabul etmez — strict şema', () => {
    // Şema fazla alanı yok sayar (zod varsayılan strip) → geçerli.
    expect(parseConditions(JSON.stringify([{ metric: 'stock_below', threshold: 5, windowHours: 24 }]))).toEqual([{ metric: 'stock_below', threshold: 5 }]);
  });
});

describe('ruleDataFromInput', () => {
  it('kapsam all ise hedefi temizler, koşulları JSON yapar', () => {
    const data = ruleDataFromInput({
      name: 'X', domain: 'stok', channel: 'notification', logic: 'and', scope: 'all', targetId: 'p1', targetLabel: 'P',
      cooldownHours: 24, conditions: [{ metric: 'stock_below', threshold: 5 }], enabled: true,
    });
    expect(data.targetId).toBeNull();
    expect(data.conditionsJson).toBe('[{"metric":"stock_below","threshold":5}]');
  });
});
