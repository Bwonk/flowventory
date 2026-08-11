import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { runFullSync } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

export type SyncApiResponse = {
  productCount: number;
  salesDayCount: number;
};

/**
 * POST /api/sync
 *
 * ikas → yerel DB tam senkronizasyonunu elle tetikler.
 * Normalde analytics endpoint'i staleness kontrolüyle otomatik sync yapar;
 * bu endpoint "şimdi yenile" ihtiyacı içindir (ör. Ayarlar sayfası butonu).
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const result = await runFullSync(user.merchantId, authToken);
    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('Manual sync error:', { error });
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
