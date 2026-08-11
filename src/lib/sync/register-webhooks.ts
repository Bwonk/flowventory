import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import type { AuthToken } from '@/models/auth-token';

/**
 * Uygulamanın dinlediği ikas webhook scope'ları.
 * (saveWebhooks'un kabul ettiği geçerli scope listesi MCP introspect ile
 * doğrulandı; store/app/deleted saveWebhooks ile kayıt edilemez — ikas
 * bunu uygulamanın webhook endpoint'ine kendisi gönderir.)
 */
export const WEBHOOK_SCOPES = [
  'store/order/created',
  'store/order/updated',
  'store/product/created',
  'store/product/updated',
  'store/stock/created',
  'store/stock/updated',
];

/**
 * OAuth sonrası webhook kaydı. Aynı endpoint+scope için tekrar çağrılması
 * güvenlidir (ikas upsert davranışı gösterir).
 *
 * @param appUrl - Uygulamanın public https origin'i (tunnel/deploy URL'i)
 */
export async function registerWebhooks(authToken: AuthToken, appUrl: string): Promise<void> {
  const endpoint = `${appUrl.replace(/\/$/, '')}/api/ikas/webhook`;
  if (!endpoint.startsWith('https://')) {
    // ikas yalnızca https endpoint kabul ediyor; localhost'ta sessizce atla.
    logger.warn('registerWebhooks skipped: endpoint is not https', { endpoint });
    return;
  }

  const ikasClient = getIkas(authToken);
  const result = await ikasClient.mutations.saveWebhooks({
    input: { endpoint, scopes: WEBHOOK_SCOPES },
  });

  if (!result.isSuccess) {
    // Webhook kaydı kritik değil (staleness sync'i yedek mekanizma) —
    // kurulum akışını kırmamak için loglayıp devam ediyoruz.
    logger.error('registerWebhooks failed', { endpoint, errors: result.errors });
    return;
  }

  logger.info('Webhooks registered', {
    endpoint,
    scopes: result.data?.saveWebhooks?.map(w => w.scope),
  });
}
