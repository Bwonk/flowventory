import { getUserFromRequest } from '@/lib/auth-helpers';
import { buildDigestEmail, DigestNoDataError } from '@/lib/digest/run';
import { sendDigestEmail } from '@/lib/digest/email';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { checkRateLimit } from '@/lib/rate-limit';
import { EmailNotConfiguredError } from '@/lib/email/resend';
import { ResendSendError } from '@/lib/email/resend-error';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/** İstek içinde tam ikas sync'i tetikleyebilir; Hobby üst sınırı. */
export const maxDuration = 60;

const bodySchema = z.object({ frequency: z.enum(['daily', 'weekly']) });

/** Mağaza başına 10 dakikada en fazla 3 örnek — Resend kotası ve adres kötüye kullanımı için. */
const TEST_LIMIT = 3;
const TEST_WINDOW_MS = 10 * 60 * 1000;

export type DigestTestApiResponse = { sentTo: string };

/**
 * POST /api/digest/test
 *
 * Özet raporunun bir örneğini, kayıtlı bildirim adresine hemen gönderir
 * (zamanlamayı ve DigestLog'u atlar). Ayarlar'daki "Örnek gönder" butonu için.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });

    const { notificationEmail } = await getMerchantSettings(user.merchantId);
    if (!notificationEmail) {
      return NextResponse.json({ error: 'Önce bir bildirim adresi kaydedin.' }, { status: 422 });
    }

    if (!checkRateLimit(`digest-test:${user.merchantId}`, TEST_LIMIT, TEST_WINDOW_MS)) {
      return NextResponse.json({ error: 'Çok sık denendi, birkaç dakika sonra tekrar deneyin.' }, { status: 429 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const email = await buildDigestEmail(user.merchantId, authToken, parsed.data.frequency);
    await sendDigestEmail(notificationEmail, email);

    const data: DigestTestApiResponse = { sentTo: notificationEmail };
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: 'E-posta servisi yapılandırılmamış.' }, { status: 503 });
    }
    if (error instanceof DigestNoDataError) {
      return NextResponse.json({ error: 'Henüz senkronize edilmiş ürün yok.' }, { status: 422 });
    }
    if (error instanceof ResendSendError) {
      // Resend reddetti (geçersiz anahtar, doğrulanmamış domain, kota…): env sorunu, kod değil.
      logger.error('Digest test send rejected', { kind: error.kind, resendName: error.resendName, statusCode: error.statusCode });
      return NextResponse.json({ error: error.userMessage }, { status: 502 });
    }
    logger.error('Digest test send error', { error });
    return NextResponse.json({ error: 'Gönderilemedi' }, { status: 500 });
  }
}
