import { timingSafeEqual } from 'crypto';
import { runDueDigests } from '@/lib/digest/run';
import { logger } from '@/lib/logger';
import { EmailNotConfiguredError } from '@/lib/vendors/purchase-email';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET|POST /api/cron/digest
 *
 * Zamanlanmış özet raporu turu — saatte bir çağrılmak üzere. Hangi mağazanın
 * o saatte özet alacağına her mağazanın kendi saat diliminde karar verilir
 * (`lib/digest/schedule.ts`); DigestLog aynı dönemin iki kez gitmesini engeller.
 *
 * Kimlik: `Authorization: Bearer $CRON_SECRET` (Vercel Cron bu başlığı
 * kendiliğinden gönderir; GitHub Actions / crontab için curl ile verilir).
 * CRON_SECRET tanımlı değilse endpoint kapalıdır (503).
 */

function isAuthorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(request.headers.get('authorization') ?? '', 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!isAuthorized(request, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runDueDigests();
    if (result.due > 0) logger.info('Digest cron run', result);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: 'E-posta servisi yapılandırılmamış.' }, { status: 503 });
    }
    logger.error('Digest cron error', { error });
    return NextResponse.json({ error: 'Digest run failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
