import { createKanca } from '@kanca-app/ikas';
import { waitUntil } from '@vercel/functions';

/**
 * Kanca gözlemlenebilirlik istemcisi (webhook teslimatı, Admin API çağrısı,
 * kurulum metadatası). KANCA_KEY boşsa no-op'tur. waitUntil, Vercel'de
 * yanıt döndükten sonra olayların gönderilmesini bekletir; Vercel dışında
 * etkisizdir.
 */
export const kanca = createKanca({ key: process.env.KANCA_KEY, waitUntil });
