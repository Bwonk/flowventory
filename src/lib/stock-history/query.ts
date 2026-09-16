import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/** Geçmiş kayıtları bu süreden sonra budanır (90 günlük pencere + pay). */
export const STOCK_HISTORY_RETENTION_DAYS = 120;

/**
 * Verilen anda geçerli varyant stokları: her varyant için `recordedAt <= at`
 * olan en son kayıt. `DISTINCT ON` Postgres'e özgü; index (merchantId,
 * variantId, recordedAt) ile tek geçişte çözülür.
 */
export async function getStockAtOrBefore(
  merchantId: string,
  at: Date,
  variantIds?: readonly string[],
): Promise<Map<string, number>> {
  if (variantIds && variantIds.length === 0) return new Map();
  const variantFilter = variantIds
    ? Prisma.sql`AND "variantId" IN (${Prisma.join([...variantIds])})`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ variantId: string; totalStock: number }>>`
    SELECT DISTINCT ON ("variantId") "variantId", "totalStock"
    FROM "StockHistory"
    WHERE "merchantId" = ${merchantId} AND "recordedAt" <= ${at} ${variantFilter}
    ORDER BY "variantId", "recordedAt" DESC
  `;
  return new Map(rows.map(r => [r.variantId, r.totalStock]));
}

/** Ürünün (ya da tek varyantın) izlenmeye başlandığı an; kayıt yoksa null. */
export async function getTrackedSince(
  merchantId: string,
  productId: string,
  variantId?: string,
): Promise<Date | null> {
  const first = await prisma.stockHistory.findFirst({
    where: { merchantId, productId, ...(variantId ? { variantId } : {}) },
    orderBy: { recordedAt: 'asc' },
    select: { recordedAt: true },
  });
  return first?.recordedAt ?? null;
}

/** Retention dışına düşen kayıtları siler; hata yutulur (bakım işi). */
export async function pruneStockHistory(olderThanDays: number = STOCK_HISTORY_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.stockHistory.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    if (count > 0) logger.info('Stock history pruned', { count, olderThanDays });
    return count;
  } catch (error) {
    logger.warn('Stock history prune failed', { error });
    return 0;
  }
}
