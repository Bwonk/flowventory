import { getUserFromRequest } from '@/lib/auth-helpers';
import { EmailNotConfiguredError, sendViaResend } from '@/lib/email/resend';
import { ResendSendError } from '@/lib/email/resend-error';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  path: z.string().max(200).optional(),
});

/** Mağaza başına saatte 5 geri bildirim — Resend kotası ve spam için. */
const FEEDBACK_LIMIT = 5;
const FEEDBACK_WINDOW_MS = 60 * 60 * 1000;

export type FeedbackApiResponse = { ok: true };

/** HTML gövdesine kullanıcı metni gömülüyor; enjeksiyonu kes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(input: { message: string; path?: string; merchantId: string }): string {
  const body = escapeHtml(input.message).replace(/\n/g, '<br />');
  const rows: Array<[string, string]> = [
    ['Mağaza', input.merchantId],
    ['Sayfa', input.path ?? '—'],
    ['Tarih', new Date().toISOString()],
  ];
  const meta = rows
    .map(([label, value]) => `<tr><td style="padding:2px 12px 2px 0;color:#71717a">${label}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('');

  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#18181b">
  <p style="white-space:pre-wrap;margin:0 0 16px">${body}</p>
  <table style="font-size:12px;border-collapse:collapse">${meta}</table>
</div>`;
}

/**
 * POST /api/feedback
 *
 * Sidebar'daki "Geri Bildirim" panelinden gelen mesajı `FEEDBACK_TO_EMAIL`
 * adresine iletir. Kalıcı kayıt tutulmaz — kanal tek yönlü.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });

    if (!checkRateLimit(`feedback:${user.merchantId}`, FEEDBACK_LIMIT, FEEDBACK_WINDOW_MS)) {
      return NextResponse.json({ error: 'Çok sık gönderildi, biraz sonra tekrar deneyin.' }, { status: 429 });
    }

    const to = process.env.FEEDBACK_TO_EMAIL?.trim();
    if (!to) throw new EmailNotConfiguredError();

    await sendViaResend({
      to,
      subject: `Flowventory geri bildirim — ${user.merchantId}`,
      html: buildHtml({ ...parsed.data, merchantId: user.merchantId }),
    });

    const data: FeedbackApiResponse = { ok: true };
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: 'Geri bildirim kanalı yapılandırılmamış.' }, { status: 503 });
    }
    if (error instanceof ResendSendError) {
      // Resend reddetti (geçersiz anahtar, doğrulanmamış domain, kota…): env sorunu, kod değil.
      logger.error('Feedback send rejected', {
        kind: error.kind,
        resendName: error.resendName,
        statusCode: error.statusCode,
      });
      return NextResponse.json({ error: error.userMessage }, { status: 502 });
    }
    logger.error('Feedback send error', { error });
    return NextResponse.json({ error: 'Gönderilemedi' }, { status: 500 });
  }
}
