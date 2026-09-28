import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { authorize } from '@/lib/purchase-orders/http';
import { moveVendorStep, VendorMoveError, type VendorMoveStep } from '@/lib/vendors/move';

/** Parti başına ikas çağrıları uzun sürebilir; Hobby üst sınırı. */
export const maxDuration = 60;

const moveSchema = z.object({
  fromVendorId: z.string().min(1),
  toVendorName: z.string().trim().min(1, 'Tedarikçi adı gerekli').max(150),
  mode: z.enum(['merge', 'rename']),
});

export type VendorMoveApiResponse = VendorMoveStep;

/**
 * POST /api/vendors/move
 *
 * Tedarikçinin ürünlerini başka isme taşır — "Ürünleri taşı ve sil" (merge) ve
 * yeniden adlandırma (rename). Adım adım: `done` false ise istemci tekrar çağırır.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const parsed = moveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const data: VendorMoveApiResponse = await moveVendorStep(auth.merchantId, auth.authToken, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof VendorMoveError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Vendor move error', { error });
    return NextResponse.json({ error: 'Tedarikçi taşınamadı' }, { status: 500 });
  }
}
