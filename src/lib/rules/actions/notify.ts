import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { RuleActionResult } from '../types';

export interface RuleNotificationInput {
  ruleId: string;
  productId: string;
  title: string;
  body: string;
  dedupeKey: string;
}

/**
 * Zil bildirimi (type `rule`). Aynı dedupeKey Notification tablosunda da
 * tekildir — ihlal "zaten var" sayılır, hata değil.
 */
export async function createRuleNotification(merchantId: string, input: RuleNotificationInput): Promise<RuleActionResult> {
  try {
    await prisma.notification.create({ data: { merchantId, type: 'rule', ...input } });
    return { type: 'notify', ok: true, detail: 'Zile düştü' };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { type: 'notify', ok: true, detail: 'Zilde zaten vardı' };
    }
    logger.error('Rule notification failed', { merchantId, ruleId: input.ruleId, error });
    return { type: 'notify', ok: false, detail: 'Bildirim oluşturulamadı' };
  }
}
