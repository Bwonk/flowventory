import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { EmailNotConfiguredError, sendViaResend } from '@/lib/email/resend';
import { ResendSendError } from '@/lib/email/resend-error';

const message = { to: 'a@b.co', subject: 'S', html: '<p>x</p>' };

describe('sendViaResend', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('RESEND_FROM', 'Flowventory <bildirim@example.com>');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('anahtar yoksa EmailNotConfiguredError fırlatır, Resend çağrılmaz', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendViaResend(message)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Resend error döndürürse ResendSendError ile sınıflandırır', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'invalid_api_key', statusCode: 401, message: 'API key is invalid' } });
    const err = await sendViaResend(message).catch(e => e);
    expect(err).toBeInstanceOf(ResendSendError);
    expect((err as ResendSendError).kind).toBe('invalid_key');
  });

  it('SDK fırlatırsa other sınıfı', async () => {
    sendMock.mockRejectedValue(new Error('network down'));
    const err = await sendViaResend(message).catch(e => e);
    expect(err).toBeInstanceOf(ResendSendError);
    expect((err as ResendSendError).kind).toBe('other');
    expect((err as ResendSendError).message).toContain('network down');
  });

  it('başarıda from adresini env\'den alır', async () => {
    sendMock.mockResolvedValue({ data: { id: 'e1' }, error: null });
    await expect(sendViaResend(message)).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'Flowventory <bildirim@example.com>', to: 'a@b.co' }));
  });
});
