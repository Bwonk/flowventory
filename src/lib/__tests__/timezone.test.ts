import { describe, expect, it } from 'vitest';
import { dateKeyInTz, dayRangeInTz, hourInTz } from '@/lib/timezone';

const TZ = 'Europe/Istanbul'; // UTC+3, DST yok (2016'dan beri sabit)

describe('dateKeyInTz', () => {
  it('UTC gece yarısından önceki saatleri doğru güne yazar', () => {
    // 22:30 UTC = 01:30 Istanbul (ertesi gün)
    const instant = new Date('2026-08-10T22:30:00Z');
    expect(dateKeyInTz(instant, TZ)).toBe('2026-08-11');
  });

  it('gün içinde aynı günü döndürür', () => {
    const instant = new Date('2026-08-11T10:00:00Z'); // 13:00 Istanbul
    expect(dateKeyInTz(instant, TZ)).toBe('2026-08-11');
  });

  it('epoch ms girişini kabul eder', () => {
    const ms = Date.UTC(2026, 7, 10, 22, 30); // 01:30 Istanbul
    expect(dateKeyInTz(ms, TZ)).toBe('2026-08-11');
  });
});

describe('hourInTz', () => {
  it('UTC saatini merchant saatine çevirir', () => {
    expect(hourInTz(new Date('2026-08-10T22:30:00Z'), TZ)).toBe(1);
    expect(hourInTz(new Date('2026-08-11T09:00:00Z'), TZ)).toBe(12);
  });

  it('gece yarısını 0 olarak döndürür', () => {
    expect(hourInTz(new Date('2026-08-10T21:00:00Z'), TZ)).toBe(0);
  });
});

describe('dayRangeInTz', () => {
  it('gün sınırlarını merchant TZ gece yarısına göre kurar', () => {
    const { startMs, endMs } = dayRangeInTz('2026-08-11', TZ);
    // Istanbul gece yarısı = 21:00 UTC (önceki gün)
    expect(new Date(startMs).toISOString()).toBe('2026-08-10T21:00:00.000Z');
    expect(new Date(endMs).toISOString()).toBe('2026-08-11T20:59:59.999Z');
  });

  it('DST geçişli timezone\'da da 1ms boşluksuz aralık üretir', () => {
    // Berlin 2026-03-29: 23 saatlik gün (DST başlangıcı)
    const { startMs, endMs } = dayRangeInTz('2026-03-29', 'Europe/Berlin');
    const next = dayRangeInTz('2026-03-30', 'Europe/Berlin');
    expect(next.startMs - endMs).toBe(1);
    expect(endMs - startMs).toBe(23 * 3600 * 1000 - 1); // 23 saatlik gün
  });

  it('aralık içindeki her an aynı gün anahtarına çözünür', () => {
    const { startMs, endMs } = dayRangeInTz('2026-08-11', TZ);
    expect(dateKeyInTz(startMs, TZ)).toBe('2026-08-11');
    expect(dateKeyInTz(endMs, TZ)).toBe('2026-08-11');
    expect(dateKeyInTz(startMs - 1, TZ)).toBe('2026-08-10');
    expect(dateKeyInTz(endMs + 1, TZ)).toBe('2026-08-12');
  });
});
