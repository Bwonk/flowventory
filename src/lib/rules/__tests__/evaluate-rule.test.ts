import { describe, expect, it } from 'vitest';
import {
  buildRuleDedupeKey,
  evaluateRule,
  matchesScope,
  windowStartDateKey,
  type RuleTarget,
} from '@/lib/rules/evaluate-rule';
import type { TrackingRuleLike } from '@/lib/rules/types';

const now = new Date('2026-09-16T10:00:00Z');

const base: TrackingRuleLike = {
  id: 'r1',
  name: 'Hızlı eriyor',
  scope: 'all',
  targetId: null,
  targetLabel: null,
  metric: 'stock_drop',
  threshold: 50,
  thresholdUnit: 'units',
  windowHours: 24,
};

const target: RuleTarget = {
  productId: 'p1',
  productName: 'Kırmızı Tişört',
  vendorId: 'v-acme',
  currentStock: 8,
  previousStock: 63,
  soldInWindow: 55,
  soldQty30: 120,
};

describe('matchesScope', () => {
  it('all her ürünle eşleşir', () => {
    expect(matchesScope({ scope: 'all', targetId: null }, target)).toBe(true);
  });
  it('product yalnız hedef ürünle eşleşir', () => {
    expect(matchesScope({ scope: 'product', targetId: 'p1' }, target)).toBe(true);
    expect(matchesScope({ scope: 'product', targetId: 'p2' }, target)).toBe(false);
  });
  it('vendor tedarikçisiz üründe eşleşmez', () => {
    expect(matchesScope({ scope: 'vendor', targetId: 'v-acme' }, target)).toBe(true);
    expect(matchesScope({ scope: 'vendor', targetId: 'v-acme' }, { ...target, vendorId: null })).toBe(false);
  });
});

describe('evaluateRule — stock_drop', () => {
  it('adet eşiğini aşınca tetiklenir, gövde düşüşü anlatır', () => {
    const hit = evaluateRule(base, target, now);
    expect(hit?.title).toBe('Kırmızı Tişört — Hızlı eriyor');
    expect(hit?.body).toBe('Son 24 saatte stok 63 → 8 (−55 adet, %87).');
    expect(hit?.dedupeKey).toBe(buildRuleDedupeKey('r1', 'p1', now, 24));
  });
  it('eşiğin altında kalırsa tetiklenmez', () => {
    expect(evaluateRule({ ...base, threshold: 60 }, target, now)).toBeNull();
  });
  it('yüzde eşiği önceki değere göre ölçülür', () => {
    expect(evaluateRule({ ...base, thresholdUnit: 'percent', threshold: 80 }, target, now)).not.toBeNull();
    expect(evaluateRule({ ...base, thresholdUnit: 'percent', threshold: 90 }, target, now)).toBeNull();
  });
  it('önceki stok bilinmiyorsa (izleme yeni) tetiklenmez', () => {
    expect(evaluateRule(base, { ...target, previousStock: null }, now)).toBeNull();
  });
  it('stok artışında tetiklenmez', () => {
    expect(evaluateRule(base, { ...target, previousStock: 5 }, now)).toBeNull();
  });
});

describe('evaluateRule — diğer metrikler', () => {
  it('stock_below eşiğin altında tetiklenir', () => {
    const rule = { ...base, metric: 'stock_below' as const, threshold: 10 };
    expect(evaluateRule(rule, target, now)?.body).toBe('Stok 8 adet — eşik 10.');
    expect(evaluateRule(rule, { ...target, currentStock: 10 }, now)).toBeNull();
  });
  it('days_of_cover_below hızdan stok ömrü türetir', () => {
    const rule = { ...base, metric: 'days_of_cover_below' as const, threshold: 7, thresholdUnit: 'days' as const };
    // 8 adet / (120/30 = 4/gün) = 2 gün
    expect(evaluateRule(rule, target, now)?.body).toContain('~2 gün idare eder');
    expect(evaluateRule(rule, { ...target, soldQty30: 0 }, now)).toBeNull();
  });
  it('sales_above pencere satışını eşikle karşılaştırır', () => {
    const rule = { ...base, metric: 'sales_above' as const, threshold: 50, windowHours: 168 as const };
    expect(evaluateRule(rule, target, now)?.body).toBe('Son 7 günde 55 adet satıldı (eşik 50).');
  });
  it('no_sales yalnız stoklu ve satışsız üründe tetiklenir', () => {
    const rule = { ...base, metric: 'no_sales' as const, threshold: 0, windowHours: 720 as const };
    expect(evaluateRule(rule, { ...target, soldInWindow: 0 }, now)?.body).toBe('Son 30 günde satış yok; 8 adet stok bekliyor.');
    expect(evaluateRule(rule, { ...target, soldInWindow: 0, currentStock: 0 }, now)).toBeNull();
    expect(evaluateRule(rule, target, now)).toBeNull();
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
  it('aynı pencere kovasında aynı anahtar, sonraki kovada farklı', () => {
    const a = buildRuleDedupeKey('r1', 'p1', now, 24);
    const b = buildRuleDedupeKey('r1', 'p1', new Date(now.getTime() + 60 * 60 * 1000), 24);
    const c = buildRuleDedupeKey('r1', 'p1', new Date(now.getTime() + 24 * 60 * 60 * 1000), 24);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
