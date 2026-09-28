import { Prisma } from '@prisma/client';
import { getIkas } from '@/helpers/api-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { sendPurchaseOrderEmail } from '@/lib/vendors/purchase-email';
import type { AuthToken } from '@/models/auth-token';
import { replaceDraftLines, TX_TIMEOUT_MS, type DraftLineInput } from './drafts';
import { toOrderItem } from './serialize';
import { applyStockDeltas, type StockWrite } from './stock';
import {
  buildOrderText,
  OPEN_STATUSES,
  orderLabel,
  remainingQty,
  statusFromLines,
  whatsappPhone,
  type PurchaseOrderChannel,
  type PurchaseOrderItem,
} from './types';

/** İş kuralı ihlali — route bunu `status` ile döner. */
export class PurchaseOrderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PurchaseOrderError';
  }
}

const withLines = { lines: true } as const;

async function storeName(authToken: AuthToken): Promise<string | null> {
  try {
    const res = await getIkas(authToken).queries.getMerchant();
    return res.data?.getMerchant?.storeName?.trim() || null;
  } catch (error) {
    logger.warn('Store name lookup failed', { error });
    return null;
  }
}

/** Mağaza içinde sıradaki sipariş numarası; eşzamanlı çakışmada unique indeks korur. */
async function nextNumber(tx: Prisma.TransactionClient, merchantId: string): Promise<number> {
  const max = await tx.purchaseOrder.aggregate({ where: { merchantId }, _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

export type SendOrderInput = {
  vendorId: string;
  lines: DraftLineInput[];
  channels: PurchaseOrderChannel[];
  expectedAt: Date | null;
};

export type SendOrderResult = {
  order: PurchaseOrderItem;
  /** WhatsApp seçiliyse hazır mesaj ve wa.me için telefon. */
  whatsapp: { phone: string; text: string } | null;
  /** Satırlardan kaçı tedarikçide bulunamadığı için düştü. */
  skipped: number;
};

/**
 * Taslağı gönderir: satırlar istemcinin son hâline eşitlenir, numara verilir,
 * e-posta seçiliyse gider, ardından sipariş "sent" olur ve kalan adetleri
 * öneriden "yolda" düşülür. E-posta başarısızsa taslak (numarasıyla) kalır.
 */
export async function sendOrder(merchantId: string, authToken: AuthToken, input: SendOrderInput): Promise<SendOrderResult> {
  const { vendorId, lines, channels, expectedAt } = input;
  const contact = await prisma.vendorContact.findUnique({ where: { merchantId_vendorId: { merchantId, vendorId } } });
  if (channels.includes('email') && !contact?.email) {
    throw new PurchaseOrderError('Tedarikçi e-posta adresi kayıtlı değil.', 422);
  }
  const phone = contact?.phone ? whatsappPhone(contact.phone) : null;
  if (channels.includes('whatsapp') && !phone) {
    throw new PurchaseOrderError('WhatsApp için geçerli bir tedarikçi telefonu gerekli.', 422);
  }

  const snapshot = await prisma.productSnapshot.findFirst({ where: { merchantId, vendorId }, select: { vendorName: true } });
  const vendorName = snapshot?.vendorName ?? contact?.vendorName ?? vendorId;
  const settings = await getMerchantSettings(merchantId);

  let prepared: { id: string; skipped: number } | null = null;
  for (let attempt = 0; attempt < 3 && !prepared; attempt++) {
    try {
      prepared = await prisma.$transaction(async tx => {
        const draft = await replaceDraftLines(tx, merchantId, vendorId, vendorName, settings.currencyCode, lines);
        const row = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: draft.id }, select: { number: true } });
        await tx.purchaseOrder.update({
          where: { id: draft.id },
          data: { number: row.number ?? (await nextNumber(tx, merchantId)), expectedAt, vendorName },
        });
        return draft;
      }, { timeout: TX_TIMEOUT_MS });
    } catch (error) {
      const retry = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!retry || attempt === 2) throw error;
    }
  }
  if (!prepared) throw new PurchaseOrderError('Sipariş hazırlanamadı', 500);

  const draft = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: prepared.id }, include: withLines });
  if (draft.lines.length === 0) throw new PurchaseOrderError('Sipariş listesi boş.', 422);
  const label = orderLabel(draft.number) ?? '';
  const name = channels.includes('email') || channels.includes('whatsapp') ? await storeName(authToken) : null;
  const item = toOrderItem(draft);

  if (channels.includes('email') && contact?.email) {
    await sendPurchaseOrderEmail(
      contact.email,
      { label, vendorName, storeName: name, expectedAt, lines: item.lines },
      { currencyCode: settings.currencyCode, replyTo: settings.notificationEmail },
    );
  }

  const sent = await prisma.purchaseOrder.update({
    where: { id: draft.id },
    data: {
      status: 'sent',
      channels,
      sentAt: new Date(),
      sentTo: channels.includes('email') ? (contact?.email ?? null) : null,
    },
    include: withLines,
  });
  const order = toOrderItem(sent);
  return {
    order,
    whatsapp: channels.includes('whatsapp') && phone ? { phone, text: buildOrderText(order, name) } : null,
    skipped: prepared.skipped,
  };
}

/** Açık siparişler (gönderilmiş / kısmi), en yeni gönderim önce. */
export async function listOpenOrders(merchantId: string): Promise<PurchaseOrderItem[]> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { merchantId, status: { in: [...OPEN_STATUSES] } },
    include: withLines,
    orderBy: [{ expectedAt: 'asc' }, { sentAt: 'desc' }],
  });
  return rows.map(toOrderItem);
}

async function loadOpenOrder(merchantId: string, orderId: string) {
  const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, merchantId }, include: withLines });
  if (!order) throw new PurchaseOrderError('Sipariş bulunamadı', 404);
  if (!(OPEN_STATUSES as readonly string[]).includes(order.status)) {
    throw new PurchaseOrderError('Bu sipariş kapanmış', 409);
  }
  return order;
}

export type ReceiveResult = { order: PurchaseOrderItem; receiptId: string; writes: StockWrite[] };

/**
 * Teslim alma: gelen adetler ikas stoğuna (ilk depo) eklenir, satırların
 * gelen adedi artar, durum kısmi/kapalı olur. Yazılan farklar geri al için saklanır.
 */
export async function receiveOrder(
  merchantId: string,
  authToken: AuthToken,
  orderId: string,
  lines: DraftLineInput[],
): Promise<ReceiveResult> {
  const order = await loadOpenOrder(merchantId, orderId);
  const byVariant = new Map(order.lines.map(l => [l.variantId, l]));
  const deltas = lines
    .filter(l => l.qty > 0)
    .map(l => {
      const line = byVariant.get(l.variantId);
      if (!line) throw new PurchaseOrderError('Siparişte olmayan ürün', 400);
      if (l.qty > remainingQty(line)) {
        throw new PurchaseOrderError(`${line.productName}: kalan ${remainingQty(line)} adetten fazlası girilemez`, 422);
      }
      return { productId: line.productId, variantId: line.variantId, delta: l.qty };
    });
  if (deltas.length === 0) throw new PurchaseOrderError('Teslim alınacak adet girin', 422);

  const stock = await applyStockDeltas(merchantId, authToken, deltas);
  if (!stock.ok) throw new PurchaseOrderError(stock.error, 502);

  const updated = await prisma.$transaction(async tx => {
    for (const d of deltas) {
      await tx.purchaseOrderLine.update({
        where: { orderId_variantId: { orderId, variantId: d.variantId } },
        data: { receivedQty: { increment: d.delta } },
      });
    }
    const receipt = await tx.purchaseOrderReceipt.create({
      data: { orderId, merchantId, linesJson: JSON.stringify(stock.writes) },
      select: { id: true },
    });
    const fresh = await tx.purchaseOrderLine.findMany({ where: { orderId } });
    const status = statusFromLines(fresh);
    const row = await tx.purchaseOrder.update({
      where: { id: orderId },
      data: { status, closedAt: status === 'closed' || status === 'cancelled' ? new Date() : null },
      include: withLines,
    });
    return { row, receiptId: receipt.id };
  }, { timeout: TX_TIMEOUT_MS });
  return { order: toOrderItem(updated.row), receiptId: updated.receiptId, writes: stock.writes };
}

function parseWrites(json: string): StockWrite[] {
  try {
    const raw: unknown = JSON.parse(json);
    return Array.isArray(raw) ? (raw as StockWrite[]) : [];
  } catch {
    return [];
  }
}

/**
 * Teslimi geri al: önce talep edilir (undoneAt), sonra ikas stoğundan
 * eklenen adet çıkarılır ve gelen adetler geri düşer. Çift tık tek kez işler.
 */
export async function undoReceipt(
  merchantId: string,
  authToken: AuthToken,
  orderId: string,
  receiptId: string,
): Promise<PurchaseOrderItem> {
  const receipt = await prisma.purchaseOrderReceipt.findFirst({ where: { id: receiptId, orderId, merchantId } });
  if (!receipt) throw new PurchaseOrderError('Teslim kaydı bulunamadı', 404);
  const claim = await prisma.purchaseOrderReceipt.updateMany({
    where: { id: receiptId, undoneAt: null },
    data: { undoneAt: new Date() },
  });
  if (claim.count === 0) throw new PurchaseOrderError('Bu teslim zaten geri alındı', 409);

  const writes = parseWrites(receipt.linesJson);
  const stock = await applyStockDeltas(
    merchantId,
    authToken,
    writes.map(w => ({ productId: w.productId, variantId: w.variantId, delta: -w.delta })),
  ).catch(error => {
    logger.error('Receipt undo stock write threw', { receiptId, error });
    return { ok: false as const, error: 'Stok geri alınamadı' };
  });
  if (!stock.ok) {
    await prisma.purchaseOrderReceipt.update({ where: { id: receiptId }, data: { undoneAt: null } });
    throw new PurchaseOrderError(stock.error, 502);
  }

  const row = await prisma.$transaction(async tx => {
    for (const w of writes) {
      const line = await tx.purchaseOrderLine.findUnique({ where: { orderId_variantId: { orderId, variantId: w.variantId } } });
      if (!line) continue;
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { receivedQty: Math.max(0, line.receivedQty - w.delta) },
      });
    }
    const fresh = await tx.purchaseOrderLine.findMany({ where: { orderId } });
    const status = statusFromLines(fresh);
    return tx.purchaseOrder.update({
      where: { id: orderId },
      data: { status, closedAt: status === 'closed' || status === 'cancelled' ? new Date() : null },
      include: withLines,
    });
  }, { timeout: TX_TIMEOUT_MS });
  return toOrderItem(row);
}

/** Kalanı iptal et: gelmeyen adetler iptal sayılır, sipariş kapanır (hiç gelmediyse iptal). */
export async function cancelRemaining(merchantId: string, orderId: string): Promise<PurchaseOrderItem> {
  const order = await loadOpenOrder(merchantId, orderId);
  const row = await prisma.$transaction(async tx => {
    for (const line of order.lines) {
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { cancelledQty: Math.max(0, line.qty - line.receivedQty) },
      });
    }
    const fresh = await tx.purchaseOrderLine.findMany({ where: { orderId } });
    const status = statusFromLines(fresh);
    return tx.purchaseOrder.update({ where: { id: orderId }, data: { status, closedAt: new Date() }, include: withLines });
  }, { timeout: TX_TIMEOUT_MS });
  return toOrderItem(row);
}
