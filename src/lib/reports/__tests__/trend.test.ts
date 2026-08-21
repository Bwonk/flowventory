import { describe, expect, it } from 'vitest';
import { percentDelta } from '@/lib/reports/trend';

describe('percentDelta', () => {
  it('artış ve azalışı tam sayı yüzdeye çevirir', () => {
    expect(percentDelta(120, 100)).toBe(20);
    expect(percentDelta(80, 100)).toBe(-20);
    expect(percentDelta(100, 100)).toBe(0);
  });

  it('tam sayıya yuvarlar', () => {
    expect(percentDelta(105, 90)).toBe(17); // 16.67 → 17
  });

  it('önceki dönem 0 ya da negatifse null', () => {
    expect(percentDelta(50, 0)).toBeNull();
    expect(percentDelta(50, -10)).toBeNull();
  });
});
