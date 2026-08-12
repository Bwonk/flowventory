import { describe, expect, it } from 'vitest';
import {
  annualTurnoverRate,
  daysUntilStockout,
  isStockoutBeforeLeadTime,
  isWithinForecastHorizon,
  overallSellThrough,
  sellThroughBand,
  sellThroughRate,
} from '@/lib/reports/sell-through';

describe('sellThroughRate', () => {
  it('satılan ÷ (satılan + kalan) oranını verir', () => {
    expect(sellThroughRate(30, 70)).toBeCloseTo(0.3);
    expect(sellThroughRate(75, 25)).toBeCloseTo(0.75);
  });

  it('stok bittiyse 1 döner', () => {
    expect(sellThroughRate(40, 0)).toBe(1);
  });

  it('hiç satış yoksa 0 döner', () => {
    expect(sellThroughRate(0, 50)).toBe(0);
  });

  it('ne satış ne stok varsa null döner', () => {
    expect(sellThroughRate(0, 0)).toBeNull();
  });

  it('negatif değerleri sıfır sayar (bozuk veri)', () => {
    expect(sellThroughRate(-5, 10)).toBe(0);
  });
});

describe('sellThroughBand', () => {
  it('yüksek/normal/düşük bantlarını ayırır', () => {
    expect(sellThroughBand(80, 20)).toBe('yüksek'); // 0.80
    expect(sellThroughBand(40, 60)).toBe('normal'); // 0.40
    expect(sellThroughBand(10, 90)).toBe('düşük'); // 0.10
  });

  it('bant sınırları dahil sayılır', () => {
    expect(sellThroughBand(60, 40)).toBe('yüksek'); // tam 0.60
    expect(sellThroughBand(25, 75)).toBe('normal'); // tam 0.25
  });

  it('stoklu ama hiç satmayan ürün satışsız', () => {
    expect(sellThroughBand(0, 30)).toBe('satışsız');
  });

  it('veri yoksa null döner', () => {
    expect(sellThroughBand(0, 0)).toBeNull();
  });
});

describe('annualTurnoverRate', () => {
  it('dönem satışını yıla çevirip stoğa böler', () => {
    // 30 günde 30 adet → yılda ~365; stok 100 → ~3.65 devir
    expect(annualTurnoverRate(30, 30, 100)).toBeCloseTo(3.65, 2);
  });

  it('stok yoksa ölçülemez (null)', () => {
    expect(annualTurnoverRate(50, 30, 0)).toBeNull();
  });

  it('satış yoksa 0 devir', () => {
    expect(annualTurnoverRate(0, 30, 100)).toBe(0);
  });

  it('geçersiz pencerede null döner', () => {
    expect(annualTurnoverRate(10, 0, 100)).toBeNull();
  });
});

describe('daysUntilStockout', () => {
  it('mevcut hızla kaç gün kaldığını yuvarlar', () => {
    // 30 günde 60 adet → günde 2; stok 50 → 25 gün
    expect(daysUntilStockout(50, 60, 30)).toBe(25);
  });

  it('stok zaten yoksa 0', () => {
    expect(daysUntilStockout(0, 60, 30)).toBe(0);
  });

  it('satış yoksa tahmin edilemez (null)', () => {
    expect(daysUntilStockout(50, 0, 30)).toBeNull();
  });
});

describe('isStockoutBeforeLeadTime', () => {
  it('tedarik süresinden önce bitecekse true', () => {
    expect(isStockoutBeforeLeadTime(5, 7)).toBe(true);
    expect(isStockoutBeforeLeadTime(7, 7)).toBe(true);
  });

  it('tedarik süresinden sonra bitecekse false', () => {
    expect(isStockoutBeforeLeadTime(20, 7)).toBe(false);
  });

  it('tahmin yoksa risk sayılmaz', () => {
    expect(isStockoutBeforeLeadTime(null, 7)).toBe(false);
  });
});

describe('isWithinForecastHorizon', () => {
  it('2 yıla kadar olan tahminleri kabul eder', () => {
    expect(isWithinForecastHorizon(0)).toBe(true);
    expect(isWithinForecastHorizon(730)).toBe(true);
  });

  it('2 yılı aşan tahmini anlamsız sayar', () => {
    // Ayda 1 satan, 500 stoklu ürün: "2100'de biter" bilgi değil gürültü.
    expect(isWithinForecastHorizon(731)).toBe(false);
    expect(isWithinForecastHorizon(15_000)).toBe(false);
  });

  it('tahmin yoksa false', () => {
    expect(isWithinForecastHorizon(null)).toBe(false);
  });
});

describe('overallSellThrough', () => {
  it('ürün oranlarının ortalamasını değil, adet toplamlarının oranını verir', () => {
    // Ürün oranları %50 ve %1; adet ağırlıklı sonuç küçük ürüne kaymamalı.
    const result = overallSellThrough({ soldUnits: 1 + 10, stockUnits: 1 + 990 });
    expect(result).toBeCloseTo(11 / 1002, 4);
  });

  it('veri yoksa null', () => {
    expect(overallSellThrough({ soldUnits: 0, stockUnits: 0 })).toBeNull();
  });
});
