import type { ErrorResponse } from 'resend';

/**
 * Resend hata sınıflandırması — saf.
 *
 * Resend SDK gönderim hatasını `{ name, statusCode, message }` olarak döner;
 * `name` makine kodu (`invalid_api_key`, `validation_error` …). Route'lar
 * jenerik 500 yerine kullanıcıya ne yapacağını söyleyen mesajla 502 dönsün
 * diye burada beş sınıfa indirgenir. (Kanıt: prod'da "API key is invalid"
 * 500 "Gönderilemedi" olarak görünüyordu — kimse anahtarın yanlış olduğunu
 * anlayamıyordu.)
 */

export type ResendErrorKind = 'invalid_key' | 'domain_not_allowed' | 'invalid_from' | 'rate_limited' | 'other';

export type ResendErrorLike = Pick<ErrorResponse, 'name' | 'statusCode' | 'message'>;

export const RESEND_KIND_MESSAGES: Record<ResendErrorKind, string> = {
  invalid_key:
    "E-posta servisi gönderimi reddetti: API anahtarı geçersiz. Vercel'deki RESEND_API_KEY değerini kontrol edin.",
  domain_not_allowed:
    'E-posta servisi gönderimi reddetti: gönderen domain bu anahtar için doğrulanmamış. RESEND_FROM ve Resend domain ayarını kontrol edin.',
  invalid_from: 'E-posta servisi gönderimi reddetti: RESEND_FROM adresi geçersiz.',
  rate_limited: 'E-posta servisi kotayı aştı; birazdan yeniden deneyin.',
  other: 'E-posta servisi gönderimi reddetti.',
};

export function classifyResendError(error: ResendErrorLike): ResendErrorKind {
  switch (error.name) {
    case 'missing_api_key':
    case 'invalid_api_key':
    case 'restricted_api_key':
      return 'invalid_key';
    case 'invalid_access':
      return 'domain_not_allowed';
    case 'invalid_from_address':
      return 'invalid_from';
    case 'rate_limit_exceeded':
    case 'daily_quota_exceeded':
    case 'monthly_quota_exceeded':
      return 'rate_limited';
    case 'validation_error':
      // Resend, doğrulanmamış domain'i de "validation_error" + 403 ile döner.
      if (error.statusCode === 403) return 'domain_not_allowed';
      if (/from/i.test(error.message ?? '')) return 'invalid_from';
      return 'other';
    default:
      return 'other';
  }
}

/** Resend'in reddettiği gönderim — sınıf + kullanıcıya dönük mesaj taşır. */
export class ResendSendError extends Error {
  readonly kind: ResendErrorKind;
  readonly resendName: string;
  readonly statusCode: number | null;
  readonly userMessage: string;

  constructor(error: ResendErrorLike) {
    super(`Resend error (${error.name}/${error.statusCode ?? '-'}): ${error.message}`);
    this.name = 'ResendSendError';
    this.kind = classifyResendError(error);
    this.resendName = error.name;
    this.statusCode = error.statusCode ?? null;
    this.userMessage = RESEND_KIND_MESSAGES[this.kind];
  }
}

/** Log bağlamı için: ResendSendError ise sınıfı, değilse undefined. */
export function resendErrorKind(error: unknown): ResendErrorKind | undefined {
  return error instanceof ResendSendError ? error.kind : undefined;
}
