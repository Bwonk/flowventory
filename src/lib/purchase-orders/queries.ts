import { prisma } from '@/lib/prisma';
import { OPEN_STATUSES } from './types';

export type IncomingInfo = { qty: number; expectedAt: Date | null };

/** variantId → gönderilmiş siparişlerde henüz gelmemiş adet + en yakın beklenen tarih. */
export async function getIncomingByVariant(merchantId: string): Promise<Map<string, IncomingInfo>> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { merchantId, order: { status: { in: [...OPEN_STATUSES] } } },
    select: { variantId: true, qty: true, receivedQty: true, cancelledQty: true, order: { select: { expectedAt: true } } },
  });
  const map = new Map<string, IncomingInfo>();
  for (const line of lines) {
    const remaining = line.qty - line.receivedQty - line.cancelledQty;
    if (remaining <= 0) continue;
    const prev = map.get(line.variantId);
    const expectedAt = line.order.expectedAt;
    const earliest =
      prev?.expectedAt && expectedAt ? (prev.expectedAt < expectedAt ? prev.expectedAt : expectedAt) : (prev?.expectedAt ?? expectedAt);
    map.set(line.variantId, { qty: (prev?.qty ?? 0) + remaining, expectedAt: earliest });
  }
  return map;
}

/** variantId → açık taslaktaki adet. */
export async function getDraftQtyByVariant(merchantId: string): Promise<Map<string, number>> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { merchantId, order: { status: 'draft' } },
    select: { variantId: true, qty: true },
  });
  return new Map(lines.map(l => [l.variantId, l.qty]));
}

/** Açık (gönderilmiş / kısmi) sipariş sayısı. */
export function countOpenOrders(merchantId: string): Promise<number> {
  return prisma.purchaseOrder.count({ where: { merchantId, status: { in: [...OPEN_STATUSES] } } });
}
