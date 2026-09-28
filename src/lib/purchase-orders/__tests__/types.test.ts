import { describe, expect, it } from 'vitest';
import { buildOrderText, isLate, orderLabel, remainingQty, statusFromLines, whatsappPhone } from '@/lib/purchase-orders/types';

describe('orderLabel', () => {
  it('dört haneli PO numarası', () => {
    expect(orderLabel(7)).toBe('PO-0007');
    expect(orderLabel(12345)).toBe('PO-12345');
    expect(orderLabel(null)).toBeNull();
  });
});

describe('statusFromLines', () => {
  const line = (qty: number, receivedQty = 0, cancelledQty = 0) => ({ qty, receivedQty, cancelledQty });

  it('hiç gelmediyse gönderildi', () => {
    expect(statusFromLines([line(10), line(5)])).toBe('sent');
  });
  it('bir kısmı geldiyse kısmi', () => {
    expect(statusFromLines([line(10, 4), line(5)])).toBe('partial');
  });
  it('hepsi geldiyse kapandı', () => {
    expect(statusFromLines([line(10, 10), line(5, 5)])).toBe('closed');
  });
  it('gelmeyen iptal edildiyse kapandı', () => {
    expect(statusFromLines([line(10, 4, 6)])).toBe('closed');
  });
  it('hiçbiri gelmeden iptal edildiyse iptal', () => {
    expect(statusFromLines([line(10, 0, 10)])).toBe('cancelled');
  });
  it('kalan adet negatife inmez', () => {
    expect(remainingQty(line(5, 7))).toBe(0);
  });
});

describe('whatsappPhone', () => {
  it('yerel numarayı 90 ile başlatır', () => {
    expect(whatsappPhone('0532 000 00 00')).toBe('905320000000');
    expect(whatsappPhone('532 000 0000')).toBe('905320000000');
    expect(whatsappPhone('+90 (532) 000-00-00')).toBe('905320000000');
  });
  it('çok kısa numarayı reddeder', () => {
    expect(whatsappPhone('1234')).toBeNull();
  });
});

describe('buildOrderText', () => {
  it('mağaza adı, numara ve satırları içerir, fiyat içermez', () => {
    const text = buildOrderText(
      {
        label: 'PO-0003',
        vendorName: 'Atlas',
        expectedAt: null,
        lines: [
          { variantId: 'v', productId: 'p', productName: 'Keten Gömlek', variantName: 'Beyaz · M', sku: 'KG-M', qty: 20, receivedQty: 0, cancelledQty: 0, unitCost: 90 },
        ],
      },
      'Raf Butik',
    );
    expect(text).toContain('Raf Butik');
    expect(text).toContain('PO-0003');
    expect(text).toContain('Keten Gömlek – Beyaz · M [KG-M]: 20 adet');
    expect(text).not.toContain('90');
  });
});

describe('isLate', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  it('beklenen günü geçmiş açık sipariş gecikmiştir', () => {
    expect(isLate({ status: 'sent', expectedAt: '2026-10-03T12:00:00Z' }, now)).toBe(true);
  });
  it('beklenen gün bugünse gecikmemiştir', () => {
    expect(isLate({ status: 'sent', expectedAt: '2026-10-05T12:00:00Z' }, now)).toBe(false);
  });
  it('kapanmış sipariş gecikmez', () => {
    expect(isLate({ status: 'closed', expectedAt: '2026-10-01T12:00:00Z' }, now)).toBe(false);
  });
});
