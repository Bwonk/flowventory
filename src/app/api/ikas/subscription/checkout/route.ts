import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { BillingDisabledError, createSubscriptionPayment } from '@/lib/billing/subscription-service';
import { NextRequest, NextResponse } from 'next/server';

export interface SubscriptionCheckoutApiResponse {
  paymentId: string;
}

/**
 * POST /api/ikas/subscription/checkout
 * Plan için ikas ödeme kaydı oluşturur (createMerchantAppPayment). Yanıtta
 * yalnız ödeme id'si döner; ödeme ekranını istemci App Bridge ile açar.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    }

    const data = await createSubscriptionPayment(authToken);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof BillingDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    logger.error('Subscription checkout error', { error });
    return NextResponse.json({ error: 'Ödeme başlatılamadı' }, { status: 500 });
  }
}
