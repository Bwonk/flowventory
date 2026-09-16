import { prisma } from '@/lib/prisma';
import type { AuthToken } from '@/models/auth-token';
import { AuthTokenManager } from '@/models/auth-token/manager';

/**
 * Cron/arka plan bağlamında JWT yoktur; merchant'ın OAuth token'ı
 * AuthToken tablosundan (en güncel yetkili kayıt) alınır.
 */
export async function getMerchantAuthToken(merchantId: string): Promise<AuthToken | undefined> {
  const row = await prisma.authToken.findFirst({
    where: { merchantId, deleted: false, authorizedAppId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { authorizedAppId: true },
  });
  return row?.authorizedAppId ? AuthTokenManager.get(row.authorizedAppId) : undefined;
}
