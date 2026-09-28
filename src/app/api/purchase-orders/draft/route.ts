import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { applyDraftChanges, MAX_LINE_QTY } from '@/lib/purchase-orders/drafts';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';

const draftSchema = z.object({
  set: z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(MAX_LINE_QTY) })).max(1000).default([]),
  remove: z.array(z.string().min(1)).max(1000).default([]),
});

export type DraftUpdateApiResponse = { ok: true };

/**
 * PUT /api/purchase-orders/draft
 *
 * Satın Alma tablosundaki tik/adet değişiklikleri tedarikçinin açık taslağına
 * yazılır (tik = kalıcı taslak). Tedarikçi ürünün snapshot'ından okunur.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const parsed = draftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    const { currencyCode } = await getMerchantSettings(auth.merchantId);
    await applyDraftChanges(auth.merchantId, currencyCode, parsed.data);
    const data: DraftUpdateApiResponse = { ok: true };
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Taslak kaydedilemedi', 'Purchase order draft PUT');
  }
}
