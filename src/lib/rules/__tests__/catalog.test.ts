import { describe, expect, it } from 'vitest';
import {
  defaultCondition,
  describeCondition,
  evaluateCondition,
  METRIC_CATALOG,
  METRICS_BY_DOMAIN,
  STAGE_METRICS,
} from '@/lib/rules/catalog';
import { RULE_METRICS, type RuleTarget } from '@/lib/rules/types';

const todayKey = '2026-09-16';

/** flat: her gün `perDay` satış; stok `stock`. */
function target(stock: number, perDay: number, overrides: Partial<RuleTarget> = {}): RuleTarget {
  const soldByDate = new Map<string, number>();
  for (let d = 29; d >= 0; d--) {
    soldByDate.set(new Date(Date.UTC(2026, 8, 16 - d)).toISOString().slice(0, 10), perDay);
  }
  return {
    productId: 'p1',
    variantId: null,
    productName: 'Ürün',
    vendorId: null,
    currentStock: stock,
    previousStockByWindow: new Map(),
    soldByDate,
    soldQty30: perDay * 30,
    dailyQuantities: Array.from({ length: 30 }, () => perDay),
    abcClass: 'B',
    leadTimeDays: 7,
    targetStockDays: 30,
    todayKey,
    ...overrides,
  };
}

describe('katalog bütünlüğü', () => {
  it('her metrik alanına göre listelenir ve etiketlidir', () => {
    const listed = [...METRICS_BY_DOMAIN.stok, ...METRICS_BY_DOMAIN.satinalma, ...METRICS_BY_DOMAIN.analiz, ...STAGE_METRICS];
    expect(listed).toHaveLength(RULE_METRICS.length);
    expect(new Set(listed)).toEqual(new Set(RULE_METRICS));
    expect(STAGE_METRICS).toEqual(['stock_drop_since_stage', 'sales_since_stage']);
    for (const m of RULE_METRICS) expect(METRIC_CATALOG[m].label.length).toBeGreaterThan(0);
  });
  it('defaultCondition şemaya uyan koşul üretir', () => {
    for (const m of RULE_METRICS) {
      const c = defaultCondition(m, { leadTimeDays: 7 });
      expect(c.metric).toBe(m);
      expect(describeCondition(c).length).toBeGreaterThan(0);
    }
    expect(defaultCondition('days_of_cover_below', { leadTimeDays: 10 })).toEqual({ metric: 'days_of_cover_below', threshold: 10 });
  });
});

describe('stok metrikleri', () => {
  it('days_of_cover_below: 8 adet / 4 gün = 2 gün < 7', () => {
    expect(evaluateCondition({ metric: 'days_of_cover_below', threshold: 7 }, target(8, 4))).toContain('~2 gün idare eder');
    expect(evaluateCondition({ metric: 'days_of_cover_below', threshold: 7 }, target(8, 0))).toBeNull();
  });
  it('sales_above pencere satışını eşikle karşılaştırır (7 gün × 4 = 28)', () => {
    expect(evaluateCondition({ metric: 'sales_above', threshold: 25, windowHours: 168 }, target(8, 4))).toBe('Son 7 günde 28 adet satıldı (eşik 25).');
    expect(evaluateCondition({ metric: 'sales_above', threshold: 30, windowHours: 168 }, target(8, 4))).toBeNull();
  });
  it('no_sales yalnız stoklu ve satışsız üründe', () => {
    expect(evaluateCondition({ metric: 'no_sales', windowHours: 720 }, target(40, 0))).toBe('Son 30 günde satış yok; 40 adet stok bekliyor.');
    expect(evaluateCondition({ metric: 'no_sales', windowHours: 720 }, target(0, 0))).toBeNull();
    expect(evaluateCondition({ metric: 'no_sales', windowHours: 720 }, target(40, 1))).toBeNull();
  });
  it('describe cümleleri', () => {
    expect(describeCondition({ metric: 'stock_drop', threshold: 30, thresholdUnit: 'percent', windowHours: 48 })).toBe('48 saat içinde stok %30 düşerse');
    expect(describeCondition({ metric: 'stock_below', threshold: 5 })).toBe('stok 5 adedin altına inerse');
  });
});

describe('satın alma metrikleri', () => {
  // 4/gün, σ=0 → safety 0, reorderPoint 28, hedef seviye 4×37=148.
  it('reorder_point_reached: stok ≤ 28 tetikler', () => {
    expect(evaluateCondition({ metric: 'reorder_point_reached' }, target(20, 4))).toContain('yeniden sipariş noktası 28');
    expect(evaluateCondition({ metric: 'reorder_point_reached' }, target(100, 4))).toBeNull();
    expect(evaluateCondition({ metric: 'reorder_point_reached' }, target(0, 0))).toBeNull();
  });
  it('suggested_qty_above: 148 − 20 = 128 → 130', () => {
    expect(evaluateCondition({ metric: 'suggested_qty_above', threshold: 100 }, target(20, 4))).toBe('Önerilen sipariş 130 adet (eşik 100).');
    expect(evaluateCondition({ metric: 'suggested_qty_above', threshold: 200 }, target(20, 4))).toBeNull();
  });
  it('below_safety_stock: dalgalanma yoksa emniyet stoğu 0 → tetiklenmez', () => {
    expect(evaluateCondition({ metric: 'below_safety_stock' }, target(1, 4))).toBeNull();
    const bumpy = target(1, 4, { dailyQuantities: [0, 8, 0, 8, 0, 8, 0, 8, 0, 8] });
    expect(evaluateCondition({ metric: 'below_safety_stock' }, bumpy)).toContain('emniyet stoğu');
  });
  it('describe cümleleri', () => {
    expect(describeCondition({ metric: 'reorder_point_reached' })).toBe('yeniden sipariş noktasına gelirse');
    expect(describeCondition({ metric: 'suggested_qty_above', threshold: 50 })).toBe('önerilen sipariş 50 adedi geçerse');
  });
});

describe('analiz metrikleri', () => {
  it('stockout_before_lead_time: 8 adet / 4 gün = 2 gün ≤ 7', () => {
    expect(evaluateCondition({ metric: 'stockout_before_lead_time' }, target(8, 4))).toContain('tedarik süresi 7 gün');
    expect(evaluateCondition({ metric: 'stockout_before_lead_time' }, target(100, 4))).toBeNull();
  });
  it('sell_through_band_is: 120 satış / (120+8) = yüksek', () => {
    expect(evaluateCondition({ metric: 'sell_through_band_is', value: 'yüksek' }, target(8, 4))).toContain('Yüksek');
    expect(evaluateCondition({ metric: 'sell_through_band_is', value: 'düşük' }, target(8, 4))).toBeNull();
  });
  it('aging_bucket_is: 400 adet / 4 gün = 100 gün → 91-180; satışsız stok → satışsız', () => {
    expect(evaluateCondition({ metric: 'aging_bucket_is', value: '91-180' }, target(400, 4))).toContain('91-180');
    expect(evaluateCondition({ metric: 'aging_bucket_is', value: 'satışsız' }, target(40, 0))).toContain('Satışsız');
    expect(evaluateCondition({ metric: 'aging_bucket_is', value: 'satışsız' }, target(0, 0))).toBeNull();
  });
  it('abc_class_is: sınıf yoksa (hesaplanmadı) tetiklenmez', () => {
    expect(evaluateCondition({ metric: 'abc_class_is', value: 'B' }, target(8, 4))).toBe('ABC sınıfı: B.');
    expect(evaluateCondition({ metric: 'abc_class_is', value: 'B' }, target(8, 4, { abcClass: null }))).toBeNull();
  });
  it('action_is: A/B sınıfı + tedarikten önce tükenme → sipariş ver', () => {
    expect(evaluateCondition({ metric: 'action_is', value: 'siparis-ver' }, target(8, 4))).toBe('Aksiyon: Sipariş ver.');
    expect(evaluateCondition({ metric: 'action_is', value: 'siparis-ver' }, target(8, 4, { abcClass: 'C' }))).toBeNull();
    expect(evaluateCondition({ metric: 'action_is', value: 'eritme-adayi' }, target(40, 0, { abcClass: 'C' }))).toBe('Aksiyon: Eritme adayı.');
  });
  it('describe cümleleri', () => {
    expect(describeCondition({ metric: 'action_is', value: 'siparis-ver' })).toBe("aksiyon 'Sipariş ver' ise");
    expect(describeCondition({ metric: 'aging_bucket_is', value: '180+' })).toBe('yaşlandırma 180+ gün ise');
  });
});

describe('aşamadan beri metrikleri', () => {
  const stage = { stockAtStage: 20, soldSinceStage: 6 };
  it('stock_drop_since_stage: önceki aşamadaki stoğa göre düşüş', () => {
    expect(evaluateCondition({ metric: 'stock_drop_since_stage', threshold: 3 }, target(17, 1, { stage }))).toBe(
      'Önceki aşamadan beri stok 20 → 17 (−3 adet).',
    );
    expect(evaluateCondition({ metric: 'stock_drop_since_stage', threshold: 3 }, target(18, 1, { stage }))).toBeNull();
  });
  it('aşama bağlamı yoksa (aşama 1) tetiklenmez', () => {
    expect(evaluateCondition({ metric: 'stock_drop_since_stage', threshold: 1 }, target(0, 1))).toBeNull();
    expect(evaluateCondition({ metric: 'sales_since_stage', threshold: 1 }, target(0, 1))).toBeNull();
  });
  it('sales_since_stage eşiği', () => {
    expect(evaluateCondition({ metric: 'sales_since_stage', threshold: 5 }, target(10, 1, { stage }))).toBe(
      'Önceki aşamadan beri 6 adet satıldı (eşik 5).',
    );
    expect(evaluateCondition({ metric: 'sales_since_stage', threshold: 7 }, target(10, 1, { stage }))).toBeNull();
  });
  it('describe cümleleri', () => {
    expect(describeCondition({ metric: 'stock_drop_since_stage', threshold: 3 })).toBe('stok 3 adet daha düşerse');
    expect(describeCondition({ metric: 'sales_since_stage', threshold: 5 })).toBe('5 adet daha satılırsa');
  });
});
