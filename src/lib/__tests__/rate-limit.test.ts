import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('limit dahilindeki istekleri kabul eder', () => {
    const key = `t1-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it('limit aşımında reddeder', () => {
    const key = `t2-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('pencere dolunca sayaç sıfırlanır', () => {
    const key = `t3-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it('farklı anahtarlar birbirini etkilemez', () => {
    const a = `t4a-${Math.random()}`;
    const b = `t4b-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(a, 3, 60_000);
    expect(checkRateLimit(a, 3, 60_000)).toBe(false);
    expect(checkRateLimit(b, 3, 60_000)).toBe(true);
  });
});
