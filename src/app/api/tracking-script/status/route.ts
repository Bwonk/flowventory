import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import {
  getTrackingScriptStatus,
  type TrackingScriptStatus,
} from '@/lib/tracking-script';
import { NextRequest, NextResponse } from 'next/server';

export type TrackingScriptStatusApiResponse = TrackingScriptStatus;

/**
 * GET /api/tracking-script/status
 * Merchant için takip scripti kurulum durumunu döner.
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

    const data = await getTrackingScriptStatus(user.merchantId);
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Tracking script status error', { error });
    const message =
      error instanceof TypeError && String(error).includes('findUnique')
        ? 'Veritabanı istemcisi güncel değil. ikas app dev’i yeniden başlatın.'
        : 'Kurulum durumu alınamadı';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
