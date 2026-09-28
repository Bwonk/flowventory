import { NextRequest, NextResponse } from 'next/server';
import { purchaseOrderFileName } from '@/lib/documents/purchase-order';
import { renderPurchaseOrderPdf } from '@/lib/documents/purchase-order-pdf';
import { authorize, errorResponse } from '@/lib/purchase-orders/http';
import { loadOrderPdfDocument } from '@/lib/purchase-orders/service';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/purchase-orders/:id/pdf — gönderilmiş siparişin tedarikçi belgesi
 * (A4 PDF). Gönder penceresindeki "PDF" kanalı ve Yolda çekmecesi kullanır;
 * e-posta eki aynı şablondan çizilir.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await context.params;
    const doc = await loadOrderPdfDocument(auth.merchantId, auth.authToken, id);
    const pdf = await renderPurchaseOrderPdf(doc);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${purchaseOrderFileName(doc)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, 'PDF oluşturulamadı', 'Purchase order PDF');
  }
}
