import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { buildPurchaseReport } from '@/lib/reports/purchase-report';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

// Hesap ve tipler lib'e taşındı (tedarikçi e-postası da aynı raporu üretir);
// mevcut importlar kırılmasın diye tipler buradan yeniden dışa verilir.
export type {
  PurchaseReportLine,
  PurchaseReportVendor,
  PurchaseReportApiResponse,
} from '@/lib/reports/purchase-report';

/**
 * GET /api/reports/purchase
 *
 * Tedarikçi bazlı satın alma önerisi raporu. Sync katmanından
 * (ProductSnapshot + SalesDaily) hesaplanır; formül `lib/reports/purchase.ts`,
 * rapor kurulumu `lib/reports/purchase-report.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const data = await buildPurchaseReport(user.merchantId, authToken);
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Purchase report error', { error });
    return NextResponse.json({ error: 'Failed to build purchase report' }, { status: 500 });
  }
}
