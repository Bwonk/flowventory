import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_LINE_QTY } from '@/lib/purchase-orders/drafts';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { receiveOrder, type ReceiveResult } from '@/lib/purchase-orders/service';

type RouteContext = { params: Promise<{ id: string }> };

const receiveSchema = z.object({
  lines: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(0).max(MAX_LINE_QTY) })).min(1).max(500),
});

export type ReceivePurchaseOrderApiResponse = ReceiveResult;

/** POST /api/purchase-orders/:id/receive — gelen adetleri ikas stoğuna yazar, siparişi kısmi/kapalı yapar. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await context.params;
    const parsed = receiveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    const data: ReceivePurchaseOrderApiResponse = await receiveOrder(auth.merchantId, auth.authToken, id, parsed.data.lines);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Teslim alınamadı', 'Purchase order receive');
  }
}
