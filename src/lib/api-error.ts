import { isAxiosError } from 'axios';

/**
 * Sunucunun `{ error: string }` gövdesindeki Türkçe mesajı çıkarır; yoksa
 * verilen genel kopya. Toast'larda API hatalarını göstermek için ortak nokta.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const serverError = (error.response?.data as { error?: string } | undefined)?.error;
    if (serverError) return serverError;
  }
  return fallback;
}
