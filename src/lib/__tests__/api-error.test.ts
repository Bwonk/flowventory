import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from '@/lib/api-error';

function axiosErrorWith(data: unknown): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError('Request failed', '422', { headers }, null, {
    data,
    status: 422,
    statusText: 'Unprocessable',
    headers,
    config: { headers },
  });
}

describe('extractErrorMessage', () => {
  it('sunucunun error alanını döner', () => {
    expect(extractErrorMessage(axiosErrorWith({ error: 'Stok sınırı aşıldı' }), 'genel')).toBe('Stok sınırı aşıldı');
  });

  it('error alanı yoksa fallback döner', () => {
    expect(extractErrorMessage(axiosErrorWith({}), 'genel')).toBe('genel');
  });

  it('axios dışı hatada fallback döner', () => {
    expect(extractErrorMessage(new Error('boom'), 'genel')).toBe('genel');
  });
});
