import { sendAlertEmail } from '@/lib/alerts/email';
import { resendErrorKind } from '@/lib/email/resend-error';
import { logger } from '@/lib/logger';
import type { RuleActionResult } from '../types';

/**
 * Turdaki tüm e-posta aksiyonları tek e-postada gider (v2 davranışı);
 * sonuç her tetiğin `actionsJson`'una aynı yazılır.
 */
export async function sendRuleEmails(
  merchantId: string,
  to: string | null,
  items: ReadonlyArray<{ title: string; body: string }>,
): Promise<RuleActionResult> {
  if (!to) {
    logger.warn('Email rule action triggered but no notification email set', { merchantId, count: items.length });
    return { type: 'email', ok: false, detail: 'Bildirim adresi kayıtlı değil' };
  }
  try {
    await sendAlertEmail(
      to,
      items.map(i => ({ type: 'rule', title: i.title, body: i.body })),
      { heading: 'Takip Kuralı Uyarıları', subject: `Flowventory: ${items.length} kural uyarısı` },
    );
    return { type: 'email', ok: true, detail: `${to} adresine gönderildi` };
  } catch (error) {
    logger.error('Rule email failed', { merchantId, kind: resendErrorKind(error), error });
    return { type: 'email', ok: false, detail: 'E-posta gönderilemedi' };
  }
}
