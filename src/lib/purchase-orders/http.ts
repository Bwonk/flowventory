import { NextResponse } from 'next/server';
import { EmailNotConfiguredError } from '@/lib/email/resend';
import { ResendSendError } from '@/lib/email/resend-error';
import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import type { NextRequest } from 'next/server';
import type { AuthToken } from '@/models/auth-token';
import { PurchaseOrderError } from './service';

/** Sipariş uçlarının ortak girişi: oturum + ikas token'ı; yoksa hazır yanıt. */
export async function authorize(
  request: NextRequest,
): Promise<{ merchantId: string; authToken: AuthToken } | { response: NextResponse }> {
  const user = getUserFromRequest(request);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const authToken = await AuthTokenManager.get(user.authorizedAppId);
  if (!authToken) return { response: NextResponse.json({ error: 'Auth token not found' }, { status: 404 }) };
  return { merchantId: user.merchantId, authToken };
}

/** Bilinen hataları anlaşılır yanıta çevirir; kalanı loglayıp 500. */
export function errorResponse(error: unknown, fallback: string, context: string): NextResponse {
  if (error instanceof PurchaseOrderError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof EmailNotConfiguredError) {
    return NextResponse.json({ error: 'E-posta servisi yapılandırılmamış.' }, { status: 503 });
  }
  if (error instanceof ResendSendError) {
    logger.error(`${context} email rejected`, { kind: error.kind, resendName: error.resendName, statusCode: error.statusCode });
    return NextResponse.json({ error: error.userMessage }, { status: 502 });
  }
  logger.error(`${context} error`, { error });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
