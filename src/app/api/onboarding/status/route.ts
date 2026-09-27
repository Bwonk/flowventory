import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/onboarding-status';
import { NextRequest, NextResponse } from 'next/server';

export type OnboardingStatusApiResponse = OnboardingStatus;

/**
 * GET /api/onboarding/status
 * Başlarken adımlarının sunucuda bilinen tamamlanma durumu.
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

    const data = await getOnboardingStatus(user.merchantId);
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Onboarding status error', { error });
    return NextResponse.json({ error: 'Kurulum durumu alınamadı' }, { status: 500 });
  }
}
