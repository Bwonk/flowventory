import { describe, expect, it } from 'vitest';
import { windowStartDateKey } from '@/lib/rules/catalog';
import {
  buildRuleDedupeKey,
  evaluateRule,
  matchesScope,
  nextState,
  soldSinceStage,
  targetKeyOf,
  type RuleStateLike,
} from '@/lib/rules/evaluate-rule';
import type { RuleTarget, RuleWorkflow, TrackingRuleLike } from '@/lib/rules/types';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-16T10:00:00Z');
const todayKey = '2026-09-16';

const single: TrackingRuleLike = {
  id: 'r1',
  name: 'Hızlı eriyor',
  scope: 'all',
  targetId: null,
  targetLabel: null,
  granularity: 'product',
  cooldownHours: 24,
  resetHours: 168,
  maxRunsPerDay: 1,
  workflow: {
    stages: [
      {
        conditions: [{ op: 'and', condition: { metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 } }],
        actions: [{ type: 'notify' }],
      },
    ],
  },
};

/** A1: stok 10'un altında → bildirim · A2: 3 adet daha düşerse → e-posta. */
const escalate: TrackingRuleLike = {
  ...single,
  id: 'r2',
  name: 'Tırmanan',
  workflow: {
    stages: [
      { conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 10 } }], actions: [{ type: 'notify' }] },
      { conditions: [{ op: 'and', condition: { metric: 'stock_drop_since_stage', threshold: 3 } }], actions: [{ type: 'email' }] },
    ],
  },
};

/** Son 30 gün: her gün 4 satış, bugün 55 satış. */
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
    variantId: null,
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

const state = (overrides: Partial<RuleStateLike> = {}): RuleStateLike => ({
  stageIndex: 1,
  stockAtStage: 9,
  soldAtStageKey: todayKey,
  soldOnStageDay: 50,
  stageFiredAt: new Date(now.getTime() - 2 * HOUR),
  ...overrides,
});

describe('matchesScope / targetKeyOf', () => {
  it('all her ürünle, product yalnız hedefle, vendor tedarikçisizle eşleşmez', () => {
    expect(matchesScope({ scope: 'all', targetId: null }, target())).toBe(true);
    expect(matchesScope({ scope: 'product', targetId: 'p1' }, target())).toBe(true);
    expect(matchesScope({ scope: 'product', targetId: 'p2' }, target())).toBe(false);
    expect(matchesScope({ scope: 'vendor', targetId: 'v-acme' }, target({ vendorId: null }))).toBe(false);
  });
  it('varyant anahtarı ürün:varyant', () => {
    expect(targetKeyOf(target())).toBe('p1');
    expect(targetKeyOf(target({ variantId: 'v1' }))).toBe('p1:v1');
  });
});

describe('evaluateRule — tek aşama', () => {
  it('stok düşüşü eşiği aşınca tetiklenir; gövde ve aksiyonlar döner', () => {
    const { hit, reset } = evaluateRule(single, target(), null, now);
    expect(reset).toBe(false);
    expect(hit?.title).toBe('Kırmızı Tişört — Hızlı eriyor');
    expect(hit?.body).toBe('Son 24 saatte stok 63 → 8 (−55 adet, %87).');
    expect(hit?.actions).toEqual([{ type: 'notify' }]);
    expect(hit?.dedupeKey).toBe(buildRuleDedupeKey('r1', 'p1', 0, now, 24));
  });
  it('önceki stok bilinmiyorsa tetiklenmez; aşamasız kural tetiklenmez', () => {
    expect(evaluateRule(single, target({ previousStockByWindow: new Map([[24, null]]) }), null, now).hit).toBeNull();
    expect(evaluateRule({ ...single, workflow: { stages: [] } }, target(), null, now).hit).toBeNull();
  });
  it('tek aşamalı kuralda durum tutulmaz', () => {
    expect(nextState(single, target(), { stageIndex: 0 }, now)).toBeNull();
  });
});

describe('evaluateRule — koşul başına bağlaç', () => {
  const workflow = (ops: Array<'and' | 'or'>): RuleWorkflow => ({
    stages: [
      {
        conditions: [
          { op: ops[0], condition: { metric: 'stock_below', threshold: 5 } }, // stok 8 → sağlanmaz
          { op: ops[1], condition: { metric: 'abc_class_is', value: 'B' } }, // A → sağlanmaz
          { op: ops[2], condition: { metric: 'stock_drop', threshold: 50, thresholdUnit: 'units', windowHours: 24 } }, // sağlanır
        ],
        actions: [{ type: 'notify' }],
      },
    ],
  });
  it('A ve B ya da C: yalnız C yeterli', () => {
    expect(evaluateRule({ ...single, workflow: workflow(['and', 'and', 'or']) }, target(), null, now).hit?.body).toBe(
      'Son 24 saatte stok 63 → 8 (−55 adet, %87).',
    );
  });
  it('A ya da B ve C: B sağlanmadığı için C tek başına yetmez', () => {
    expect(evaluateRule({ ...single, workflow: workflow(['and', 'or', 'and']) }, target(), null, now).hit).toBeNull();
  });
});

describe('evaluateRule — aşama ilerlemesi', () => {
  it('durum yok → aşama 1 değerlendirilir', () => {
    const { hit } = evaluateRule(escalate, target(), null, now);
    expect(hit?.stageIndex).toBe(0);
    expect(hit?.title).toBe('Kırmızı Tişört — Tırmanan (aşama 1)');
    expect(hit?.dedupeKey).toBe('rule:r2:p1:s0:' + Math.floor(now.getTime() / (24 * HOUR)));
  });
  it('aşama 1 sonrası durum aşama 2\'ye geçer ve o anki stoğu/satışı kaydeder', () => {
    expect(nextState(escalate, target(), { stageIndex: 0 }, now)).toEqual({
      stageIndex: 1,
      stockAtStage: 8,
      soldAtStageKey: todayKey,
      soldOnStageDay: 55,
      stageFiredAt: now,
    });
  });
  it('stok aksiyonu yazdıysa taban yazım sonrası stok', () => {
    expect(nextState(escalate, target(), { stageIndex: 0 }, now, 13)?.stockAtStage).toBe(13);
  });
  it('aşama 2 yalnız "aşamadan beri" koşuluyla: 9 → 8 yetmez, 9 → 6 tetikler', () => {
    expect(evaluateRule(escalate, target(), state(), now)).toEqual({ reset: false, hit: null });
    const { hit } = evaluateRule(escalate, target({ currentStock: 6 }), state(), now);
    expect(hit?.stageIndex).toBe(1);
    expect(hit?.actions).toEqual([{ type: 'email' }]);
    expect(hit?.body).toBe('Önceki aşamadan beri stok 9 → 6 (−3 adet).');
  });
  it('son aşama tetiklenince orada kalır, taban yenilenir', () => {
    expect(nextState(escalate, target({ currentStock: 6 }), { stageIndex: 1 }, now)?.stageIndex).toBe(1);
  });
  it('aşama 1 koşulu artık sağlanmıyorsa başa döner', () => {
    const { reset, hit } = evaluateRule(escalate, target({ currentStock: 40 }), state(), now);
    expect(reset).toBe(true);
    expect(hit).toBeNull();
  });
  it('resetHours dolduysa başa döner ve aşama 1 yeniden değerlendirilir', () => {
    const old = state({ stageFiredAt: new Date(now.getTime() - 168 * HOUR) });
    const { reset, hit } = evaluateRule(escalate, target({ currentStock: 2 }), old, now);
    expect(reset).toBe(true);
    expect(hit?.stageIndex).toBe(0);
  });
  it('kural aşama silerek düzenlendiyse durum son aşamaya kırpılır', () => {
    const three = { ...escalate, workflow: { stages: [...escalate.workflow.stages] } };
    expect(evaluateRule(three, target({ currentStock: 6 }), state({ stageIndex: 5 }), now).hit?.stageIndex).toBe(1);
  });
});

describe('soldSinceStage', () => {
  it('tetik günündeki önceki satışlar düşülür', () => {
    expect(soldSinceStage(target(), state({ soldOnStageDay: 50 }))).toBe(5);
    expect(soldSinceStage(target(), state({ soldAtStageKey: '2026-09-15', soldOnStageDay: 2 }))).toBe(57);
    expect(soldSinceStage(target(), state({ soldOnStageDay: 99 }))).toBe(0);
  });
});

describe('windowStartDateKey', () => {
  it('24s bugün, 48s dün, 7g altı gün önce', () => {
    expect(windowStartDateKey('2026-09-16', 24)).toBe('2026-09-16');
    expect(windowStartDateKey('2026-09-16', 48)).toBe('2026-09-15');
    expect(windowStartDateKey('2026-09-16', 168)).toBe('2026-09-10');
  });
});

describe('buildRuleDedupeKey — cooldown kovası aşama bazlı', () => {
  it('aynı kovada aynı anahtar, sonraki kovada ya da başka aşamada farklı', () => {
    const a = buildRuleDedupeKey('r1', 'p1', 0, now, 24);
    expect(buildRuleDedupeKey('r1', 'p1', 0, new Date(now.getTime() + HOUR), 24)).toBe(a);
    expect(buildRuleDedupeKey('r1', 'p1', 0, new Date(now.getTime() + 24 * HOUR), 24)).not.toBe(a);
    expect(buildRuleDedupeKey('r1', 'p1', 1, now, 24)).not.toBe(a);
  });
});
