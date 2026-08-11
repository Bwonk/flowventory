import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTrackToken, verifyTrackToken } from '@/lib/track-token';

const ORIGINAL_SECRET = process.env.CLIENT_SECRET;

beforeEach(() => {
  process.env.CLIENT_SECRET = 'test-secret';
});

afterEach(() => {
  process.env.CLIENT_SECRET = ORIGINAL_SECRET;
});

describe('track token', () => {
  it('aynı merchant için deterministik token üretir', () => {
    expect(buildTrackToken('m1')).toBe(buildTrackToken('m1'));
    expect(buildTrackToken('m1')).not.toBe(buildTrackToken('m2'));
  });

  it('geçerli token doğrulanır', () => {
    const token = buildTrackToken('merchant-a');
    expect(verifyTrackToken('merchant-a', token)).toBe(true);
  });

  it('başka merchant\'ın token\'ı reddedilir (cross-tenant koruması)', () => {
    const token = buildTrackToken('merchant-a');
    expect(verifyTrackToken('merchant-b', token)).toBe(false);
  });

  it('oynanmış token reddedilir', () => {
    const token = buildTrackToken('merchant-a');
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(verifyTrackToken('merchant-a', tampered)).toBe(false);
  });

  it('yanlış uzunluktaki token reddedilir', () => {
    expect(verifyTrackToken('merchant-a', 'kisa')).toBe(false);
  });

  it('CLIENT_SECRET yoksa doğrulama false döner', () => {
    delete process.env.CLIENT_SECRET;
    expect(verifyTrackToken('merchant-a', 'x'.repeat(64))).toBe(false);
  });
});
