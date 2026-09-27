import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getSubscriptionSummary, type SubscriptionSummary } from '@/lib/billing/subscription-service';
import { NextRequest, NextResponse } from 'next/server';

export type SubscriptionApiResponse = SubscriptionSummary;

/**
 * GET /api/ikas/subscription
 * Abonelik durumu: ikas lisansı (getMerchantLicence) + uygulamanın deneme kaydı.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    }

    const data = await getSubscriptionSummary(user.merchantId, authToken);
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Subscription status error', { error });
    return NextResponse.json({ error: 'Abonelik durumu alınamadı' }, { status: 500 });
  }
}
