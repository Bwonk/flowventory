import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import {
  installOrUpdateTrackingScript,
  TrackingScriptError,
  type TrackingScriptInstallResult,
} from '@/lib/tracking-script';
import { NextRequest, NextResponse } from 'next/server';

export type TrackingScriptInstallApiResponse = TrackingScriptInstallResult;

/**
 * POST /api/tracking-script/install
 * Storefront'a takip scriptini kurar veya mevcut kaydı günceller (upsert).
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

    const apiUrl = process.env.NEXT_PUBLIC_DEPLOY_URL || request.nextUrl.origin;

    const data = await installOrUpdateTrackingScript({
      merchantId: user.merchantId,
      authToken,
      apiUrl,
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof TrackingScriptError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Tracking script install error:', error);
    const message =
      error instanceof Error && error.message.includes('trackingScriptInstall')
        ? 'Veritabanı istemcisi güncel değil. ikas app dev’i yeniden başlatın.'
        : 'Takip scripti kurulamadı';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
