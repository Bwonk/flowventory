import { describe, expect, it } from 'vitest';
import type { DigestContent } from '@/lib/digest/compute';
import { renderDigestEmail } from '@/lib/digest/email';

const content: DigestContent = {
  frequency: 'weekly',
  ranges: {
    current: { start: '2026-08-31', end: '2026-09-06' },
    previous: { start: '2026-08-24', end: '2026-08-30' },
  },
  sales: { revenue: 12500, previousRevenue: 10000, revenueDelta: 25, units: 40, previousUnits: 50, unitsDelta: -20 },
  topProducts: [{ productId: 'p1', productName: 'Kupa <Mavi>', revenue: 5000, units: 10 }],
  stock: { productCount: 30, outOfStockCount: 2, lowStockCount: 3, warningThreshold: 10, lowest: [] },
  deadStock: { count: 0, lockedCapital: 0, isEstimate: false },
  purchase: { lineCount: 4, urgentCount: 1, totalCost: 3200, hasEstimate: true },
};

describe('renderDigestEmail', () => {
  it('konuya sıklığı ve dönemi yazar', () => {
    const { subject } = renderDigestEmail(content, 'TRY');
    expect(subject).toBe('Flowventory haftalık özet · 31 Ağu 2026 – 6 Eyl 2026');
  });

  it('günlük özette tek günü yazar', () => {
    const { subject } = renderDigestEmail(
      {
        ...content,
        frequency: 'daily',
        ranges: {
          current: { start: '2026-09-06', end: '2026-09-06' },
          previous: { start: '2026-09-05', end: '2026-09-05' },
        },
      },
      'TRY',
    );
    expect(subject).toBe('Flowventory günlük özet · 6 Eyl 2026');
  });

  it('ürün adlarını HTML olarak kaçırır', () => {
    const { html } = renderDigestEmail(content, 'TRY');
    expect(html).toContain('Kupa &lt;Mavi&gt;');
    expect(html).not.toContain('Kupa <Mavi>');
  });

  it('değişimleri ve tahmini maliyeti işaretler', () => {
    const { html } = renderDigestEmail(content, 'TRY');
    expect(html).toContain('+%25');
    expect(html).toContain('-%20');
    expect(html).toContain('~₺3.200');
    expect(html).toContain('1 acil');
  });

  it('boş bölümlerde açıklama gösterir', () => {
    const { html } = renderDigestEmail({ ...content, topProducts: [] }, 'TRY');
    expect(html).toContain('Bu dönemde satış yok.');
    expect(html).toContain('Ölü stok yok.');
    expect(html).toContain('Eşiğin altında ürün yok.');
  });
});
