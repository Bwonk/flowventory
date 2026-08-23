import { JwtHelpers } from '@/helpers/jwt-helpers';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/dev/token — YALNIZ development.
 *
 * public/dev-harness.html test sayfası için kısa ömürlü JWT üretir; ikas
 * paneli dışında (iframe AppBridge'i olmadan) sayfaları gerçek veriyle test
 * etmeye yarar. Production build'de 404 döner, hiçbir veri sızdırmaz.
 */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const authToken = await prisma.authToken.findFirst({
    select: { merchantId: true, authorizedAppId: true },
  });
  if (!authToken?.authorizedAppId || !authToken.merchantId) {
    return NextResponse.json({ error: 'No installed app in dev DB' }, { status: 404 });
  }

  const token = JwtHelpers.createToken(authToken.merchantId, authToken.authorizedAppId);
  return NextResponse.json({ data: { token, authorizedAppId: authToken.authorizedAppId } });
}
