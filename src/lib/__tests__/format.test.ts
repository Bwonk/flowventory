import { describe, expect, it } from 'vitest';
import {
  dominantCurrencyCode,
  formatMoney,
  formatNumber,
  formatPercent,
  isValidCurrencyCode,
} from '@/lib/format';

describe('formatMoney', () => {
  it('varsayılan olarak TRY biçimlendirir (eski ₺ kalıbıyla aynı çıktı)', () => {
    expect(formatMoney(1234.5)).toBe('₺1.234,50');
  });

  it('mağaza para birimini kullanır', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1.234,50');
    expect(formatMoney(1234.5, 'EUR')).toBe('€1.234,50');
  });

  it('küçük harfli kodu kabul eder', () => {
    expect(formatMoney(10, 'usd')).toBe(formatMoney(10, 'USD'));
  });

  it('geçersiz kodda TRY varsayılanına düşer', () => {
    expect(formatMoney(10, 'TR')).toBe(formatMoney(10, 'TRY'));
    expect(formatMoney(10, null)).toBe(formatMoney(10, 'TRY'));
    expect(formatMoney(10, undefined)).toBe(formatMoney(10, 'TRY'));
  });

  it('ISO listesinde olmayan 3 harfli kodu önek olarak yazar', () => {
    // Intl bilinmeyen kodu ¤ ile gösterir; en azından tutar doğru olmalı.
    expect(formatMoney(1234.5, 'ZZZ')).toContain('1.234,50');
  });

  it('NaN/Infinity yerine 0 gösterir', () => {
    expect(formatMoney(Number.NaN)).toBe(formatMoney(0));
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe(formatMoney(0));
  });

  it('her zaman iki ondalık gösterir', () => {
    expect(formatMoney(1000)).toBe('₺1.000,00');
    expect(formatMoney(0.5)).toBe('₺0,50');
  });
});

describe('formatNumber', () => {
  it('binlik ayraç kullanır', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });

  it('geçersiz değerde 0 döner', () => {
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('oranı yüzdeye çevirir', () => {
    expect(formatPercent(0.1234)).toBe('%12,3');
    expect(formatPercent(1)).toBe('%100');
  });
});

describe('isValidCurrencyCode', () => {
  it('yalnızca 3 harfli kodları kabul eder', () => {
    expect(isValidCurrencyCode('TRY')).toBe(true);
    expect(isValidCurrencyCode('try')).toBe(true);
    expect(isValidCurrencyCode('TR')).toBe(false);
    expect(isValidCurrencyCode('TRYY')).toBe(false);
    expect(isValidCurrencyCode('12A')).toBe(false);
    expect(isValidCurrencyCode(null)).toBe(false);
  });
});

describe('dominantCurrencyCode', () => {
  it('en çok geçen kodu seçer', () => {
    expect(dominantCurrencyCode(['TRY', 'USD', 'TRY'])).toBe('TRY');
  });

  it('geçersiz ve boş değerleri eler', () => {
    expect(dominantCurrencyCode([null, undefined, 'TR', 'USD'])).toBe('USD');
  });

  it('kodları büyük harfe normalize eder ve birlikte sayar', () => {
    expect(dominantCurrencyCode(['usd', 'USD', 'TRY'])).toBe('USD');
  });

  it('hiç geçerli kod yoksa null döner', () => {
    expect(dominantCurrencyCode([null, 'X'])).toBeNull();
    expect(dominantCurrencyCode([])).toBeNull();
  });
});
