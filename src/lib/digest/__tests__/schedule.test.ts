import { describe, expect, it } from 'vitest';
import { digestRanges, dueDigestPeriodKey, isDigestFrequency, type DigestSchedule } from '@/lib/digest/schedule';

const TZ = 'Europe/Istanbul'; // UTC+3

// 2026-09-07 Pazartesi. Istanbul saati = UTC + 3.
const at = (isoUtc: string) => new Date(isoUtc);
const daily: DigestSchedule = { frequency: 'daily', weekday: 1, hour: 9 };
const weekly: DigestSchedule = { frequency: 'weekly', weekday: 1, hour: 9 };

describe('dueDigestPeriodKey', () => {
  it('kapalıyken hiç vade vermez', () => {
    expect(dueDigestPeriodKey(at('2026-09-07T06:00:00Z'), { ...daily, frequency: 'off' }, TZ)).toBeNull();
  });

  it('gönderim saatinden önce vade vermez', () => {
    expect(dueDigestPeriodKey(at('2026-09-07T05:59:00Z'), daily, TZ)).toBeNull(); // 08:59
  });

  it('gönderim saatinde ve telafi penceresinde günün anahtarını verir', () => {
    expect(dueDigestPeriodKey(at('2026-09-07T06:00:00Z'), daily, TZ)).toBe('daily:2026-09-07'); // 09:00
    expect(dueDigestPeriodKey(at('2026-09-07T08:59:00Z'), daily, TZ)).toBe('daily:2026-09-07'); // 11:59
  });

  it('telafi penceresi bitince vade vermez', () => {
    expect(dueDigestPeriodKey(at('2026-09-07T09:00:00Z'), daily, TZ)).toBeNull(); // 12:00
  });

  it('saati merchant saat diliminde değerlendirir', () => {
    // 06:00 UTC, UTC'de saat 6 — 09:00 ayarıyla vade yok; Istanbul'da 09:00.
    expect(dueDigestPeriodKey(at('2026-09-07T06:00:00Z'), daily, 'UTC')).toBeNull();
  });

  it('haftalıkta yalnız seçilen günde vade verir', () => {
    expect(dueDigestPeriodKey(at('2026-09-07T06:30:00Z'), weekly, TZ)).toBe('weekly:2026-09-07');
    expect(dueDigestPeriodKey(at('2026-09-08T06:30:00Z'), weekly, TZ)).toBeNull(); // Salı
  });

  it('gün sınırını merchant saat diliminde çizer', () => {
    // Pazar 21:30 UTC = Pazartesi 00:30 Istanbul
    const midnight: DigestSchedule = { frequency: 'weekly', weekday: 1, hour: 0 };
    expect(dueDigestPeriodKey(at('2026-09-06T21:30:00Z'), midnight, TZ)).toBe('weekly:2026-09-07');
  });
});

describe('digestRanges', () => {
  it('günlükte dünü ve önceki günü kapsar', () => {
    expect(digestRanges(at('2026-09-07T06:00:00Z'), 'daily', TZ)).toEqual({
      current: { start: '2026-09-06', end: '2026-09-06' },
      previous: { start: '2026-09-05', end: '2026-09-05' },
    });
  });

  it('haftalıkta dünden geriye 7 günü ve önceki 7 günü kapsar', () => {
    expect(digestRanges(at('2026-09-07T06:00:00Z'), 'weekly', TZ)).toEqual({
      current: { start: '2026-08-31', end: '2026-09-06' },
      previous: { start: '2026-08-24', end: '2026-08-30' },
    });
  });

  it('bugünü merchant saat diliminde belirler', () => {
    // 22:00 UTC 6 Eylül = 01:00 Istanbul 7 Eylül → dün 6 Eylül
    expect(digestRanges(at('2026-09-06T22:00:00Z'), 'daily', TZ).current.end).toBe('2026-09-06');
  });
});

describe('isDigestFrequency', () => {
  it('yalnız bilinen değerleri kabul eder', () => {
    expect(isDigestFrequency('weekly')).toBe(true);
    expect(isDigestFrequency('monthly')).toBe(false);
    expect(isDigestFrequency(null)).toBe(false);
  });
});
