import type { PurchaseOrder, PurchaseOrderLine } from '@prisma/client';
import { isChannel, isStatus, orderLabel, type PurchaseOrderItem } from './types';

export type OrderWithLines = PurchaseOrder & { lines: PurchaseOrderLine[] };

export function toOrderItem(row: OrderWithLines): PurchaseOrderItem {
  const lines = row.lines
    .slice()
    .sort((a, b) => a.productName.localeCompare(b.productName, 'tr'))
    .map(l => ({
      variantId: l.variantId,
      productId: l.productId,
      productName: l.productName,
      variantName: l.variantName,
      sku: l.sku,
      qty: l.qty,
      receivedQty: l.receivedQty,
      cancelledQty: l.cancelledQty,
      unitCost: l.unitCost,
    }));
  const totalCost = lines.reduce((s, l) => s + (l.unitCost ?? 0) * l.qty, 0);
  return {
    id: row.id,
    number: row.number,
    label: orderLabel(row.number),
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    status: isStatus(row.status) ? row.status : 'draft',
    channels: row.channels.filter(isChannel),
    sentTo: row.sentTo,
    sentAt: row.sentAt?.toISOString() ?? null,
    expectedAt: row.expectedAt?.toISOString() ?? null,
    lines,
    totalCost: Math.round(totalCost * 100) / 100,
    hasUnknownCost: lines.some(l => l.unitCost === null),
  };
}
