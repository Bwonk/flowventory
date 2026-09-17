import { describe, expect, it } from 'vitest';
import { classifyResendError, RESEND_KIND_MESSAGES, ResendSendError } from '@/lib/email/resend-error';

describe('classifyResendError', () => {
  it('anahtar hatalarını invalid_key sayar', () => {
    expect(classifyResendError({ name: 'invalid_api_key', statusCode: 401, message: 'API key is invalid' })).toBe('invalid_key');
    expect(classifyResendError({ name: 'missing_api_key', statusCode: 401, message: '' })).toBe('invalid_key');
    expect(classifyResendError({ name: 'restricted_api_key', statusCode: 401, message: '' })).toBe('invalid_key');
  });

  it('doğrulanmamış domain 403 validation_error olarak gelir', () => {
    expect(classifyResendError({ name: 'validation_error', statusCode: 403, message: 'domain is not verified' })).toBe('domain_not_allowed');
    expect(classifyResendError({ name: 'invalid_access', statusCode: 403, message: '' })).toBe('domain_not_allowed');
  });

  it('from adresi hatalarını ayırır', () => {
    expect(classifyResendError({ name: 'invalid_from_address', statusCode: 422, message: '' })).toBe('invalid_from');
    expect(classifyResendError({ name: 'validation_error', statusCode: 422, message: 'Invalid `from` field' })).toBe('invalid_from');
  });

  it('kota ve hız sınırını rate_limited sayar', () => {
    expect(classifyResendError({ name: 'rate_limit_exceeded', statusCode: 429, message: '' })).toBe('rate_limited');
    expect(classifyResendError({ name: 'daily_quota_exceeded', statusCode: 429, message: '' })).toBe('rate_limited');
  });

  it('bilinmeyeni other sayar', () => {
    expect(classifyResendError({ name: 'internal_server_error', statusCode: 500, message: '' })).toBe('other');
  });
});

describe('ResendSendError', () => {
  it('sınıfı, ham adı ve kullanıcı mesajını taşır', () => {
    const err = new ResendSendError({ name: 'invalid_api_key', statusCode: 401, message: 'API key is invalid' });
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe('invalid_key');
    expect(err.resendName).toBe('invalid_api_key');
    expect(err.statusCode).toBe(401);
    expect(err.userMessage).toBe(RESEND_KIND_MESSAGES.invalid_key);
    expect(err.message).toContain('invalid_api_key/401');
  });
});
