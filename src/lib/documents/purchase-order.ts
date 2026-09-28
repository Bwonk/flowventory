import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';
import type { MerchantProfile } from './profile';

/**
 * Tedarikçiye giden satın alma siparişi belgesinin görünüm modeli — PDF ve
 * e-posta aynı modelden çizilir. Saf: veri toplama `lib/purchase-orders/document`.
 *
 * Belgede yalnız tedarikçinin işine yarayan bilgi var: stok, satış hızı ve
 * öneri iç rapordadır. Alış fiyatı bilinmeyen satır fiyatsız ("teyit edin")
 * gider — satış fiyatı tedarikçiye asla gösterilmez.
 */
export type PurchaseOrderDocumentLine = {
  index: number;
  productName: string;
  variantName: string | null;
  sku: string | null;
  qty: number;
  unitCost: number | null;
  lineTotal: number | null;
};

export type PurchaseOrderDocument = {
  /** "PO-0014" */
  label: string;
  /** Sipariş (gönderim) tarihi, ISO. */
  orderedAt: string;
  expectedAt: string | null;
  /** Sipariş → beklenen teslim arası gün (tarih yoksa null). */
  leadDays: number | null;
  currencyCode: string;
  timeZone: string;
  store: MerchantProfile;
  /** Tedarikçinin yanıtlayacağı mağaza adresi (bildirim e-postası). */
  storeEmail: string | null;
  vendor: { name: string; email: string | null; phone: string | null; casePack: number | null };
  lines: PurchaseOrderDocumentLine[];
  totalQty: number;
  /** Fiyatı bilinen satırların toplamı (KDV hariç). */
  subtotal: number;
  /** Fiyatı teyit bekleyen satır sayısı. */
  unpricedCount: number;
};

export type PurchaseOrderDocumentContext = {
  store: MerchantProfile;
  storeEmail: string | null;
  vendor: { email: string | null; phone: string | null; casePack: number | null };
  timeZone: string;
  currencyCode: string;
  /** Taslak henüz gönderilmediyse sipariş tarihi yerine kullanılır. */
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildPurchaseOrderDocument(order: PurchaseOrderItem, ctx: PurchaseOrderDocumentContext): PurchaseOrderDocument {
  const orderedAt = order.sentAt ?? (ctx.now ?? new Date()).toISOString();
  const lines = order.lines.map((l, i) => ({
    index: i + 1,
    productName: l.productName,
    variantName: l.variantName,
    sku: l.sku,
    qty: l.qty,
    unitCost: l.unitCost,
    lineTotal: l.unitCost === null ? null : Math.round(l.unitCost * l.qty * 100) / 100,
  }));
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const leadDays = order.expectedAt
    ? Math.max(0, Math.round((new Date(order.expectedAt).getTime() - new Date(orderedAt).getTime()) / DAY_MS))
    : null;
  return {
    label: order.label ?? 'Taslak',
    orderedAt,
    expectedAt: order.expectedAt,
    leadDays,
    currencyCode: ctx.currencyCode,
    timeZone: ctx.timeZone,
    store: ctx.store,
    storeEmail: ctx.storeEmail,
    vendor: { name: order.vendorName, ...ctx.vendor },
    lines,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: Math.round(subtotal * 100) / 100,
    unpricedCount: lines.filter(l => l.unitCost === null).length,
  };
}

/** Ekin dosya adı: "PO-0014-Lina-Home.pdf" (ASCII, boşluksuz). */
export function purchaseOrderFileName(doc: Pick<PurchaseOrderDocument, 'label' | 'store'>): string {
  const name = (doc.store.storeName ?? '')
    .normalize('NFKD')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${doc.label}${name ? `-${name}` : ''}.pdf`;
}
