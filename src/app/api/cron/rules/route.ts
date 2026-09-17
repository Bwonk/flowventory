import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { runTrackingRulesForAllMerchants } from '@/lib/rules/run';

export const dynamic = 'force-dynamic';
/** Merchant başına sync + değerlendirme; Hobby üst sınırı. */
export const maxDuration = 60;

/**
 * GET|POST /api/cron/rules
 *
 * Kural tabanlı takip turu — saatte bir çağrılmak üzere (.github/workflows/
 * rules-cron.yml). Kurallar sync sonrasında da değerlendirilir; bu uç kimse
 * dashboard'u açmasa bile "24 saatte 50 düştü" gibi kuralların çalışmasını
 * garanti eder. Kimlik: `Authorization: Bearer $CRON_SECRET`; secret yoksa 503.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!isCronAuthorized(request, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runTrackingRulesForAllMerchants();
    if (result.created > 0 || result.failed > 0) logger.info('Rules cron run', result);
    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('Rules cron error', { error });
    return NextResponse.json({ error: 'Rules run failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
