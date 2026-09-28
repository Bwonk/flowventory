import { NextRequest, NextResponse } from 'next/server';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { cancelRemaining } from '@/lib/purchase-orders/service';
import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';

type RouteContext = { params: Promise<{ id: string }> };

export type CancelRemainingApiResponse = { order: PurchaseOrderItem };

/** POST /api/purchase-orders/:id/cancel-remaining — gelmeyen adetleri iptal eder, siparişi kapatır. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await context.params;
    const data: CancelRemainingApiResponse = { order: await cancelRemaining(auth.merchantId, id) };
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Sipariş kapatılamadı', 'Purchase order cancel remaining');
  }
}
