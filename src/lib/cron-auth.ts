import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * Cron uçları için `Authorization: Bearer $CRON_SECRET` kontrolü (zamanlama
 * saldırısına karşı sabit süreli karşılaştırma). Secret tanımsızsa çağıran
 * 503 döner — uç kapalıdır.
 */
export function isCronAuthorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(request.headers.get('authorization') ?? '', 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
