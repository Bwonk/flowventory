import { NextRequest, NextResponse } from 'next/server';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { listOpenOrders } from '@/lib/purchase-orders/service';
import type { PurchaseOrderItem } from '@/lib/purchase-orders/types';

export type PurchaseOrdersApiResponse = { orders: PurchaseOrderItem[] };

/** GET /api/purchase-orders — açık (gönderilmiş / kısmi) siparişler: "Yolda" çekmecesi. */
export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const data: PurchaseOrdersApiResponse = { orders: await listOpenOrders(auth.merchantId) };
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Siparişler alınamadı', 'Purchase orders GET');
  }
}
