import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { ResendSendError } from './resend-error';

/**
 * Üç göndericinin (özet raporu, alarm, tedarikçi siparişi) ortak Resend çekirdeği.
 * Anahtar yoksa `EmailNotConfiguredError` (çağıran 503'e çevirir ya da sessiz
 * atlar); Resend reddederse `ResendSendError` (çağıran 502 + anlaşılır mesaj).
 */

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('RESEND_API_KEY is not set');
    this.name = 'EmailNotConfiguredError';
  }
}

const DEFAULT_FROM = 'Flowventory <onboarding@resend.dev>';

export function getResendConfig(): { apiKey: string | null; from: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
  if (apiKey && !process.env.RESEND_FROM?.trim()) {
    // Domain'e kısıtlı anahtarla varsayılan gönderici çalışmaz; erken uyar.
    logger.warn('RESEND_FROM not set, falling back to onboarding@resend.dev');
  }
  return { apiKey, from };
}

export interface ResendMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendViaResend(message: ResendMessage): Promise<void> {
  const { apiKey, from } = getResendConfig();
  if (!apiKey) throw new EmailNotConfiguredError();

  const resend = new Resend(apiKey);
  let result: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    result = await resend.emails.send({ from, ...message });
  } catch (error) {
    throw new ResendSendError({
      name: 'application_error',
      statusCode: null,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (result.error) throw new ResendSendError(result.error);
}
