/**
 * Satın alma siparişi — istemci ve sunucunun paylaştığı saf tipler/yardımcılar.
 * (Prisma'ya dokunmaz; bileşenler de import edebilir.)
 */

export const PO_STATUSES = ['draft', 'sent', 'partial', 'closed', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export const PO_CHANNELS = ['email', 'whatsapp', 'pdf'] as const;
export type PurchaseOrderChannel = (typeof PO_CHANNELS)[number];

/** Kalan adeti öneriden "yolda" olarak düşülen durumlar. */
export const OPEN_STATUSES: readonly PurchaseOrderStatus[] = ['sent', 'partial'];

export type PurchaseOrderLineItem = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  qty: number;
  receivedQty: number;
  cancelledQty: number;
  unitCost: number | null;
};

export type PurchaseOrderItem = {
  id: string;
  number: number | null;
  /** "PO-0142" — taslakta null. */
  label: string | null;
  vendorId: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  channels: PurchaseOrderChannel[];
  sentTo: string | null;
  sentAt: string | null;
  expectedAt: string | null;
  lines: PurchaseOrderLineItem[];
  /** Fiyatı bilinen satırların toplamı. */
  totalCost: number;
  /** Fiyatı bilinmeyen satır var mı? */
  hasUnknownCost: boolean;
};

export function orderLabel(number: number | null): string | null {
  return number === null ? null : `PO-${String(number).padStart(4, '0')}`;
}

export function remainingQty(line: Pick<PurchaseOrderLineItem, 'qty' | 'receivedQty' | 'cancelledQty'>): number {
  return Math.max(0, line.qty - line.receivedQty - line.cancelledQty);
}

/** Satır durumlarından sipariş durumu: hepsi kapandıysa kapalı/iptal, gelen varsa kısmi. */
export function statusFromLines(
  lines: ReadonlyArray<Pick<PurchaseOrderLineItem, 'qty' | 'receivedQty' | 'cancelledQty'>>,
): Extract<PurchaseOrderStatus, 'sent' | 'partial' | 'closed' | 'cancelled'> {
  const received = lines.reduce((s, l) => s + l.receivedQty, 0);
  const open = lines.some(l => remainingQty(l) > 0);
  if (open) return received > 0 ? 'partial' : 'sent';
  return received > 0 ? 'closed' : 'cancelled';
}

/** Beklenen tarihi geçmiş açık sipariş. */
export function isLate(order: Pick<PurchaseOrderItem, 'status' | 'expectedAt'>, now: Date = new Date()): boolean {
  if (!order.expectedAt || !OPEN_STATUSES.includes(order.status)) return false;
  const expected = new Date(order.expectedAt);
  expected.setHours(23, 59, 59, 999);
  return expected.getTime() < now.getTime();
}

export function isChannel(value: string): value is PurchaseOrderChannel {
  return (PO_CHANNELS as readonly string[]).includes(value);
}

export function isStatus(value: string): value is PurchaseOrderStatus {
  return (PO_STATUSES as readonly string[]).includes(value);
}

/** WhatsApp için telefon: yalnız rakam, 0 ile başlayan yerel numara 90'a çevrilir. */
export function whatsappPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
  return digits.length >= 10 ? digits : null;
}

/** Tedarikçiye giden düz metin (WhatsApp mesajı). Fiyatı bilinmeyen satır fiyatsız. */
export function buildOrderText(
  order: Pick<PurchaseOrderItem, 'label' | 'vendorName' | 'expectedAt' | 'lines'>,
  storeName: string | null,
): string {
  const header = [
    `Merhaba, ${storeName ? `${storeName} olarak ` : ''}sipariş listemiz${order.label ? ` (${order.label})` : ''}:`,
  ];
  const lines = order.lines.map(l => {
    const name = [l.productName, l.variantName].filter(Boolean).join(' – ');
    const sku = l.sku ? ` [${l.sku}]` : '';
    return `• ${name}${sku}: ${l.qty} adet`;
  });
  const footer: string[] = [];
  if (order.expectedAt) {
    footer.push(`Beklenen teslim: ${new Date(order.expectedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`);
  }
  footer.push('Teşekkürler.');
  return [...header, '', ...lines, '', ...footer].join('\n');
}
