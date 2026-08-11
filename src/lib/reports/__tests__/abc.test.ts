import { describe, expect, it } from 'vitest';
import { agingBucket, classifyAbc } from '@/lib/reports/abc';

describe('classifyAbc', () => {
  it('kümülatif ciro payına göre A/B/C atar', () => {
    // Toplam 100: p1=70 (%70→A), p2=15 (%85→B), p3=10 (%95→B), p4=5 (%100→C)
    const result = classifyAbc([
      { id: 'p1', revenue: 70 },
      { id: 'p2', revenue: 15 },
      { id: 'p3', revenue: 10 },
      { id: 'p4', revenue: 5 },
    ]);
    expect(result.get('p1')).toBe('A');
    expect(result.get('p2')).toBe('B');
    expect(result.get('p3')).toBe('B');
    expect(result.get('p4')).toBe('C');
  });

  it('tek ürün A olur', () => {
    expect(classifyAbc([{ id: 'x', revenue: 10 }]).get('x')).toBe('A');
  });

  it('cirosu sıfır olan ürün her zaman C', () => {
    const result = classifyAbc([
      { id: 'a', revenue: 100 },
      { id: 'z', revenue: 0 },
    ]);
    expect(result.get('z')).toBe('C');
  });

  it('hiç ciro yoksa herkes C', () => {
    const result = classifyAbc([
      { id: 'a', revenue: 0 },
      { id: 'b', revenue: 0 },
    ]);
    expect(result.get('a')).toBe('C');
    expect(result.get('b')).toBe('C');
  });
});

describe('agingBucket', () => {
  it('gün aralıklarını doğru kovalara ayırır', () => {
    expect(agingBucket(10)).toBe('0-30');
    expect(agingBucket(30)).toBe('0-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(75)).toBe('61-90');
    expect(agingBucket(120)).toBe('91-180');
    expect(agingBucket(500)).toBe('180+');
  });

  it('satışsız ürün kendi kovasına düşer', () => {
    expect(agingBucket(null)).toBe('satışsız');
  });
});
