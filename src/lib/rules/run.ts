import { logger } from '@/lib/logger';
import { getMerchantAuthToken } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { pruneStockHistory } from '@/lib/stock-history/query';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { evaluateTrackingRules, pruneRuleEvents } from './evaluate';

/** Cron uç sınırı 60 sn; bütçe dolunca kalan merchant'lar bir sonraki tura kalır. */
const TIME_BUDGET_MS = 50_000;

export type RulesRunResult = {
  /** Etkin kuralı olan merchant sayısı. */
  merchants: number;
  evaluated: number;
  /** Süre bütçesi dolduğu için bu tura giremeyenler. */
  deferred: number;
  /** Bu turda oluşturulan bildirim sayısı. */
  created: number;
  failed: number;
};

/**
 * Saatlik cron turu: etkin kuralı olan her merchant için veriyi tazele
 * (30 dk staleness) ve kuralları değerlendir; token stok aksiyonuna da gider. Değerlendirme idempotent
 * (dedupe + cooldown) — sync'in kendi tetiklediği turla çakışsa da çift
 * bildirim üretmez. Sonda stok geçmişi budanır.
 */
export async function runTrackingRulesForAllMerchants(now: Date = new Date()): Promise<RulesRunResult> {
  const merchants = await prisma.trackingRule.findMany({
    where: { enabled: true },
    distinct: ['merchantId'],
    select: { merchantId: true },
  });
  const result: RulesRunResult = { merchants: merchants.length, evaluated: 0, deferred: 0, created: 0, failed: 0 };
  const startedAt = Date.now();

  for (const { merchantId } of merchants) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      result.deferred++;
      continue;
    }
    try {
      const authToken = await getMerchantAuthToken(merchantId);
      // Tam senkron kuralları kendi sonunda değerlendirir; ikinci tur gereksiz iş.
      const synced = authToken ? await ensureFreshSync(merchantId, authToken) : false;
      if (!synced) result.created += await evaluateTrackingRules(merchantId, authToken ?? null, now);
      result.evaluated++;
    } catch (error) {
      result.failed++;
      logger.error('Tracking rules run failed for merchant', { merchantId, error });
    }
  }

  if (result.deferred > 0) logger.warn('Rules run deferred merchants (time budget)', { deferred: result.deferred });
  await pruneStockHistory();
  await pruneRuleEvents();
  return result;
}
