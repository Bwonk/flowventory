import { NextRequest, NextResponse } from 'next/server';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { undoReceipt } from '@/lib/purchase-orders/service';
import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';

type RouteContext = { params: Promise<{ id: string; receiptId: string }> };

export type UndoReceiptApiResponse = { order: PurchaseOrderItem };

/** POST /api/purchase-orders/:id/receipts/:receiptId/undo — teslimi geri alır (stok ve gelen adet düşer). */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const { id, receiptId } = await context.params;
    const data: UndoReceiptApiResponse = { order: await undoReceipt(auth.merchantId, auth.authToken, id, receiptId) };
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Teslim geri alınamadı', 'Purchase order receipt undo');
  }
}
