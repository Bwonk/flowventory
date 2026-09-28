import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_LINE_QTY } from '@/lib/purchase-orders/drafts';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { sendOrder, type SendOrderResult } from '@/lib/purchase-orders/service';
import { PO_CHANNELS } from '@/lib/purchase-orders/types';

const sendSchema = z.object({
  vendorId: z.string().min(1),
  lines: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(MAX_LINE_QTY) })).min(1).max(500),
  channels: z.array(z.enum(PO_CHANNELS)).min(1, 'En az bir kanal seçin'),
  /** YYYY-MM-DD */
  expectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type SendPurchaseOrderApiResponse = SendOrderResult;

/**
 * POST /api/purchase-orders/send
 *
 * Tedarikçinin taslağını seçilen kanallarla gönderir: e-posta sunucudan gider;
 * WhatsApp için hazır mesaj döner (istemci wa.me açar); PDF istemcide yazdırılır.
 * Başarıda sipariş "sent" olur ve kalan adetleri öneriden düşülür.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const parsed = sendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { vendorId, lines, channels, expectedAt } = parsed.data;
    const data: SendPurchaseOrderApiResponse = await sendOrder(auth.merchantId, auth.authToken, {
      vendorId,
      lines,
      channels: Array.from(new Set(channels)),
      expectedAt: expectedAt ? new Date(`${expectedAt}T12:00:00Z`) : null,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Sipariş gönderilemedi', 'Purchase order send');
  }
}
