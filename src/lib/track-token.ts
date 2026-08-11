import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Storefront tracking isteği için merchant bazlı imzalı token.
 *
 * track/view endpoint'i token'sız ve CORS'a açık olmak zorunda (müşteri
 * tarayıcısından çağrılıyor). Ama merchantId'nin body'de doğrulamasız kabul
 * edilmesi, herkesin başka bir mağaza adına sahte görüntülenme yazabilmesi
 * demek. Çözüm: kurulum sırasında tracker script'ine CLIENT_SECRET ile
 * imzalanmış bir token gömülür; endpoint bu imzayı doğrular.
 *
 * Not: Token storefront kaynağında görünür — yani bir saldırgan O mağaza
 * için replay yapabilir (rate limit bunu sınırlar) ama BAŞKA mağazalar
 * adına veri yazamaz (cross-tenant kirlilik engellenir).
 */
export function buildTrackToken(merchantId: string): string {
  const secret = process.env.CLIENT_SECRET;
  if (!secret) throw new Error('CLIENT_SECRET is not configured');
  return createHmac('sha256', secret).update(`track:${merchantId}`).digest('hex');
}

export function verifyTrackToken(merchantId: string, token: string): boolean {
  const secret = process.env.CLIENT_SECRET;
  if (!secret) return false;
  const expected = buildTrackToken(merchantId);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
