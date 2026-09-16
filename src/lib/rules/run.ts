import { logger } from '@/lib/logger';
import { getMerchantAuthToken } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { pruneStockHistory } from '@/lib/stock-history/query';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { evaluateTrackingRules } from './evaluate';

export type RulesRunResult = {
  /** Etkin kuralı olan merchant sayısı. */
  merchants: number;
  evaluated: number;
  /** Bu turda oluşturulan bildirim sayısı. */
  created: number;
  failed: number;
};

/**
 * Saatlik cron turu: etkin kuralı olan her merchant için veriyi tazele
 * (30 dk staleness) ve kuralları değerlendir. Değerlendirme idempotent
 * (dedupe + cooldown) — sync'in kendi tetiklediği turla çakışsa da çift
 * bildirim üretmez. Sonda stok geçmişi budanır.
 */
export async function runTrackingRulesForAllMerchants(now: Date = new Date()): Promise<RulesRunResult> {
  const merchants = await prisma.trackingRule.findMany({
    where: { enabled: true },
    distinct: ['merchantId'],
    select: { merchantId: true },
  });
  const result: RulesRunResult = { merchants: merchants.length, evaluated: 0, created: 0, failed: 0 };

  for (const { merchantId } of merchants) {
    try {
      const authToken = await getMerchantAuthToken(merchantId);
      if (authToken) await ensureFreshSync(merchantId, authToken);
      result.created += await evaluateTrackingRules(merchantId, now);
      result.evaluated++;
    } catch (error) {
      result.failed++;
      logger.error('Tracking rules run failed for merchant', { merchantId, error });
    }
  }

  await pruneStockHistory();
  return result;
}
