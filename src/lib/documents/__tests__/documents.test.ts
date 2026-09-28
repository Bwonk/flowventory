import { describe, expect, it } from 'vitest';
import { docMoney, packLabel } from '@/lib/documents/format';
import { profileFromMerchant, displayName, monogram } from '@/lib/documents/profile';
import { buildPurchaseOrderDocument, purchaseOrderFileName } from '@/lib/documents/purchase-order';
import { purchaseOrderEmailSubject, renderPurchaseOrderEmail } from '@/lib/documents/purchase-order-email';
import { renderPurchaseReportHtml } from '@/lib/documents/purchase-report-html';
import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';

const order: PurchaseOrderItem = {
  id: 'o1',
  number: 14,
  label: 'PO-0014',
  vendorId: 'v1',
  vendorName: 'Metin Tekstil',
  status: 'sent',
  channels: ['email'],
  sentTo: 'siparis@example.com',
  sentAt: '2026-09-28T09:00:00Z',
  expectedAt: '2026-10-05T12:00:00Z',
  lines: [
    { variantId: 'a', productId: 'p', productName: 'Bambu Havlu', variantName: 'Krem', sku: 'BHS-1', qty: 30, receivedQty: 0, cancelledQty: 0, unitCost: 120 },
    { variantId: 'b', productId: 'p', productName: 'Muslin <Battaniye>', variantName: null, sku: null, qty: 26, receivedQty: 0, cancelledQty: 0, unitCost: null },
  ],
  totalCost: 3600,
  hasUnknownCost: true,
};

const store = profileFromMerchant({
  id: 'm',
  email: 'staff@example.com',
  storeName: ' Lina Home ',
  phoneNumber: '0216 000 00 00',
  address: {
    company: 'Lina Ev Tekstili Ltd. Şti.',
    taxOffice: 'Kadıköy',
    taxNumber: '111',
    vkn: '0000000000',
    addressLine1: 'Örnek Mah. Depo Sk. No 4',
    postalCode: '34000',
    city: { name: 'İstanbul' },
    district: { name: 'Kadıköy' },
  },
});

const doc = buildPurchaseOrderDocument(order, {
  store,
  storeEmail: 'satinalma@example.com',
  vendor: { email: 'siparis@example.com', phone: null, casePack: 10 },
  timeZone: 'Europe/Istanbul',
  currencyCode: 'TRY',
});

describe('belge biçimleri', () => {
  it('TL kısaltmasıyla yazar (Geist ₺ glifi taşımıyor)', () => {
    expect(docMoney(21950, 'TRY')).toBe('21.950,00 TL');
    expect(docMoney(12.5, 'eur')).toBe('12,50 EUR');
  });

  it('koli etiketi yalnız tam katta', () => {
    expect(packLabel(30, 10)).toBe('3 koli × 10');
    expect(packLabel(26, 10)).toBeNull();
    expect(packLabel(30, 1)).toBeNull();
    expect(packLabel(30, null)).toBeNull();
  });
});

describe('profileFromMerchant', () => {
  it('ikas fatura bilgisini belge alanlarına çevirir', () => {
    expect(store).toEqual({
      storeName: 'Lina Home',
      legalName: 'Lina Ev Tekstili Ltd. Şti.',
      taxOffice: 'Kadıköy',
      taxNumber: '0000000000',
      addressLines: ['Örnek Mah. Depo Sk. No 4', '34000 Kadıköy / İstanbul'],
      phone: '0216 000 00 00',
    });
  });

  it('boş hesapta varsayılan ad ve Türkçe monogram', () => {
    const empty = profileFromMerchant(null);
    expect(displayName(empty)).toBe('Mağazamız');
    expect(monogram('ılgın')).toBe('I');
    expect(monogram('istanbul')).toBe('İ');
  });
});

describe('buildPurchaseOrderDocument', () => {
  it('fiyatsız satırı toplama katmaz, ayrıca sayar', () => {
    expect(doc.subtotal).toBe(3600);
    expect(doc.unpricedCount).toBe(1);
    expect(doc.totalQty).toBe(56);
    expect(doc.lines.map(l => l.index)).toEqual([1, 2]);
    expect(doc.lines[1].lineTotal).toBeNull();
  });

  it('teslim süresini gün olarak hesaplar', () => {
    expect(doc.leadDays).toBe(7);
  });

  it('dosya adı ASCII', () => {
    expect(purchaseOrderFileName(doc)).toBe('PO-0014-Lina-Home.pdf');
    expect(purchaseOrderFileName({ label: 'PO-0002', store: { ...store, storeName: 'Işıl Çiçek Evi' } })).toBe('PO-0002-Isil-Cicek-Evi.pdf');
  });
});

describe('renderPurchaseOrderEmail', () => {
  const html = renderPurchaseOrderEmail(doc, { hasAttachment: true });

  it('konu satırında numara, mağaza ve kalem sayısı', () => {
    expect(purchaseOrderEmailSubject(doc)).toBe('PO-0014 · Lina Home satın alma siparişi (2 kalem)');
  });

  it('fiyatsız satırda tutar yerine teyit ister, adları kaçırır', () => {
    expect(html).toContain('Teyit edin');
    expect(html).toContain('Muslin &lt;Battaniye&gt;');
    expect(html).not.toContain('<Battaniye>');
    expect(html).toContain('3.600,00 TL');
  });

  it('eki olan e-posta resmî kopyayı PDF olarak anar', () => {
    expect(html).toContain('ekteki PDF');
    expect(renderPurchaseOrderEmail(doc, { hasAttachment: false })).not.toContain('ekteki PDF');
  });
});

describe('renderPurchaseReportHtml', () => {
  const line = {
    productName: 'Kraft & Kutu',
    variantName: null,
    sku: 'K-1',
    currentStock: 4,
    dailyAvg: 1.2,
    daysOfCover: 3.3,
    incoming: 0,
    rawQty: 36,
    suggestedQty: 40,
    needsOrder: true,
    urgent: true,
    qty: 30,
    unitCost: 100,
    isEstimate: true,
  };
  const html = renderPurchaseReportHtml({
    storeName: null,
    generatedAt: '2026-09-28T13:26:00Z',
    timeZone: 'Europe/Istanbul',
    currencyCode: 'TRY',
    targetStockDays: 30,
    salesWindowDays: 30,
    fontBaseUrl: 'https://app.example',
    vendors: [{ name: 'Metin', unassigned: false, leadTimeDays: 7, lines: [line] }],
  });

  it('tarayıcı başlık/altlığını kapatır ve kendi fontunu yükler', () => {
    expect(html).toContain('@page{size:A4 landscape;margin:0}');
    expect(html).toContain('https://app.example/fonts/Geist-Variable.woff2');
  });

  it('tahmini tutarı ~ ile, öneri yuvarlamasını okla gösterir', () => {
    expect(html).toContain('~3.000,00 TL');
    expect(html).toContain('36 → 40');
    expect(html).toContain('Kraft &amp; Kutu');
  });
});
