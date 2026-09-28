import { describe, expect, it } from 'vitest';
import { isFreshPress, PRESS_WINDOW_MS, transformOriginFor } from '../use-trigger-origin';

describe('transformOriginFor', () => {
  it('tetikleyici merkezini yüzeyin sol-üst köşesine göre yazar', () => {
    expect(transformOriginFor({ x: 120, y: 40 }, { left: 100, top: 60 })).toBe('20px -20px');
  });

  it('alt piksel değerleri yuvarlar', () => {
    expect(transformOriginFor({ x: 10.6, y: 5.4 }, { left: 0, top: 0 })).toBe('11px 5px');
  });
});

describe('isFreshPress', () => {
  it('pencere içindeki basışı kabul eder', () => {
    expect(isFreshPress(1000, 1000 + PRESS_WINDOW_MS)).toBe(true);
  });

  it('eski basıştan büyütmez', () => {
    expect(isFreshPress(1000, 1001 + PRESS_WINDOW_MS)).toBe(false);
  });

  it('gelecekteki zaman damgasını reddeder', () => {
    expect(isFreshPress(2000, 1000)).toBe(false);
  });
});
