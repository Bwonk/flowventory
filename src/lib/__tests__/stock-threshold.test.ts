// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_STOCK_THRESHOLD, normalizeThreshold } from '@/lib/stock-threshold';

describe('normalizeThreshold', () => {
  it('geçerli değerleri olduğu gibi bırakır', () => {
    expect(normalizeThreshold({ min: 3, max: 8 })).toEqual({ min: 3, max: 8 });
  });

  it('min > max ise min\'i max\'a indirir', () => {
    expect(normalizeThreshold({ min: 20, max: 10 })).toEqual({ min: 10, max: 10 });
  });

  it('negatif değerleri sıfıra çeker', () => {
    expect(normalizeThreshold({ min: -5, max: -1 })).toEqual({ min: 0, max: 0 });
  });

  it('eksik alanlarda varsayılanları kullanır', () => {
    expect(normalizeThreshold({})).toEqual(DEFAULT_STOCK_THRESHOLD);
    expect(normalizeThreshold({ min: 2 })).toEqual({ min: 2, max: DEFAULT_STOCK_THRESHOLD.max });
  });

  it('sayı olmayan girdilerde varsayılana düşer', () => {
    expect(normalizeThreshold({ min: Number.NaN, max: Number.NaN })).toEqual(DEFAULT_STOCK_THRESHOLD);
  });

  it('ondalıkları aşağı yuvarlar', () => {
    expect(normalizeThreshold({ min: 2.9, max: 7.5 })).toEqual({ min: 2, max: 7 });
  });
});
