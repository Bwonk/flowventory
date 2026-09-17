import { describe, expect, it } from 'vitest';
import { buildRuleDedupeKey, evaluateRule, matchesScope } from '@/lib/rules/evaluate-rule';
import { windowStartDateKey } from '@/lib/rules/catalog';
import type { RuleTarget, TrackingRuleLike } from '@/lib/rules/types';

const now = new Date('2026-09-16T10:00:00Z');
const todayKey = '2026-09-16';

const base: TrackingRuleLike = {
  id: 'r1',
  name: 'Hızlı eriyor',
  scope: 'all',
  targetId: null,
  targetLabel: null,
  domain: 'stok',
  channel: 'notification',
  logic: 'and',
  cooldownHours: 24,
  conditions: [{ metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 }],
};

/** Son 30 gün: her gün 4 satış (hız 4/gün), bugün 55 satış. */
function target(overrides: Partial<RuleTarget> = {}): RuleTarget {
  const soldByDate = new Map<string, number>();
  for (let d = 29; d >= 1; d--) {
    const key = new Date(Date.UTC(2026, 8, 16 - d)).toISOString().slice(0, 10);
    soldByDate.set(key, 4);
  }
  soldByDate.set(todayKey, 55);
  const daily = Array.from(soldByDate.values());
  return {
    productId: 'p1',
    productName: 'Kırmızı Tişört',
    vendorId: 'v-acme',
    currentStock: 8,
    previousStockByWindow: new Map([[24, 63]]),
    soldByDate,
    soldQty30: daily.reduce((a, b) => a + b, 0),
    dailyQuantities: daily,
    abcClass: 'A',
    leadTimeDays: 7,
    targetStockDays: 30,
    todayKey,
    ...overrides,
  };
}

describe('matchesScope', () => {
  it('all her ürünle eşleşir', () => {
    expect(matchesScope({ scope: 'all', targetId: null }, target())).toBe(true);
  });
  it('product yalnız hedef ürünle eşleşir', () => {
    expect(matchesScope({ scope: 'product', targetId: 'p1' }, target())).toBe(true);
    expect(matchesScope({ scope: 'product', targetId: 'p2' }, target())).toBe(false);
  });
  it('vendor tedarikçisiz üründe eşleşmez', () => {
    expect(matchesScope({ scope: 'vendor', targetId: 'v-acme' }, target())).toBe(true);
    expect(matchesScope({ scope: 'vendor', targetId: 'v-acme' }, target({ vendorId: null }))).toBe(false);
  });
});

describe('evaluateRule — tek koşul', () => {
  it('stok düşüşü eşiği aşınca tetiklenir, gövde düşüşü anlatır', () => {
    const hit = evaluateRule(base, target(), now);
    expect(hit?.title).toBe('Kırmızı Tişört — Hızlı eriyor');
    expect(hit?.body).toBe('Son 24 saatte stok 63 → 8 (−55 adet, %87).');
    expect(hit?.dedupeKey).toBe(buildRuleDedupeKey('r1', 'p1', now, 24));
  });
  it('önceki stok bilinmiyorsa (izleme yeni) tetiklenmez', () => {
    expect(evaluateRule(base, target({ previousStockByWindow: new Map([[24, null]]) }), now)).toBeNull();
  });
  it('koşulsuz kural tetiklenmez', () => {
    expect(evaluateRule({ ...base, conditions: [] }, target(), now)).toBeNull();
  });
});

describe('evaluateRule — VE / VEYA', () => {
  const two: TrackingRuleLike = {
    ...base,
    conditions: [
      { metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 },
      { metric: 'stock_below', threshold: 5 }, // stok 8 → sağlanmaz
    ],
  };

  it('VE: biri sağlanmazsa tetiklenmez', () => {
    expect(evaluateRule({ ...two, logic: 'and' }, target(), now)).toBeNull();
  });
  it('VEYA: biri yeterli; gövde yalnız sağlananları içerir', () => {
    const hit = evaluateRule({ ...two, logic: 'or' }, target(), now);
    expect(hit?.body).toBe('Son 24 saatte stok 63 → 8 (−55 adet, %87).');
  });
  it('VE: hepsi sağlanınca gövdeler birleşir', () => {
    const hit = evaluateRule({ ...two, logic: 'and' }, target({ currentStock: 3 }), now);
    expect(hit?.body).toBe('Son 24 saatte stok 63 → 3 (−60 adet, %95). Stok 3 adet — eşik 5.');
  });
});

describe('windowStartDateKey', () => {
  it('24s bugün, 48s dün, 7g altı gün önce', () => {
    expect(windowStartDateKey('2026-09-16', 24)).toBe('2026-09-16');
    expect(windowStartDateKey('2026-09-16', 48)).toBe('2026-09-15');
    expect(windowStartDateKey('2026-09-16', 168)).toBe('2026-09-10');
  });
});

describe('buildRuleDedupeKey', () => {
  it('aynı aralık kovasında aynı anahtar, sonraki kovada farklı', () => {
    const a = buildRuleDedupeKey('r1', 'p1', now, 24);
    const b = buildRuleDedupeKey('r1', 'p1', new Date(now.getTime() + 60 * 60 * 1000), 24);
    const c = buildRuleDedupeKey('r1', 'p1', new Date(now.getTime() + 24 * 60 * 60 * 1000), 24);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
