import { describe, expect, it } from 'vitest';
import {
  buildProjection,
  dailyStockSeries,
  daysOfCover,
  velocityPerDay,
} from '@/lib/stock-history/projection';

const TZ = 'Europe/Istanbul';
const d = (iso: string) => new Date(iso);

describe('velocityPerDay / daysOfCover', () => {
  it('30 günlük satıştan günlük hız üretir', () => {
    expect(velocityPerDay(30)).toBe(1);
    expect(velocityPerDay(0)).toBe(0);
  });

  it('stok yoksa 0, hız yoksa null, aksi hâlde yuvarlanmış gün', () => {
    expect(daysOfCover(0, 1)).toBe(0);
    expect(daysOfCover(10, 0)).toBeNull();
    expect(daysOfCover(10, 0.8)).toBe(13);
  });
});

describe('buildProjection', () => {
  it('hızla 0\'a iner ve tükeniş gününü verir', () => {
    const p = buildProjection(5, 2, '2026-09-16');
    expect(p.points.map(x => x.stock)).toEqual([5, 3, 1, 0]);
    expect(p.stockoutDate).toBe('2026-09-19');
  });

  it('hız yoksa düz çizgi ve tükeniş null', () => {
    const p = buildProjection(5, 0, '2026-09-16', 30);
    expect(p.points).toEqual([
      { date: '2026-09-16', stock: 5 },
      { date: '2026-10-16', stock: 5 },
    ]);
    expect(p.stockoutDate).toBeNull();
  });

  it('ufka sığmazsa kesilir, tükeniş null', () => {
    const p = buildProjection(1000, 1, '2026-09-16', 90);
    expect(p.points).toHaveLength(91);
    expect(p.stockoutDate).toBeNull();
  });

  it('stok yoksa tükeniş bugündür', () => {
    expect(buildProjection(0, 1, '2026-09-16').stockoutDate).toBe('2026-09-16');
  });
});

describe('dailyStockSeries', () => {
  const records = [
    { variantId: 'v1', totalStock: 10, recordedAt: d('2026-09-10T08:00:00Z') },
    { variantId: 'v1', totalStock: 6, recordedAt: d('2026-09-12T08:00:00Z') },
    { variantId: 'v2', totalStock: 4, recordedAt: d('2026-09-11T08:00:00Z') },
  ];

  it('gün sonu değerlerini varyant bazında toplar ve izleme öncesini atlar', () => {
    const series = dailyStockSeries(records, '2026-09-09', '2026-09-13', 9, TZ);
    expect(series).toEqual([
      { date: '2026-09-10', stock: 10 },
      { date: '2026-09-11', stock: 14 },
      { date: '2026-09-12', stock: 10 },
      { date: '2026-09-13', stock: 9 },
    ]);
  });

  it('kayıt yoksa yalnız bugünü döner', () => {
    expect(dailyStockSeries([], '2026-09-09', '2026-09-13', 3, TZ)).toEqual([{ date: '2026-09-13', stock: 3 }]);
  });
});
