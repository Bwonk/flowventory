import { sendAlertEmail } from '@/lib/alerts/email';
import { resendErrorKind } from '@/lib/email/resend-error';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { sumProductPrevious } from '@/lib/stock-history/change';
import { VELOCITY_WINDOW_DAYS } from '@/lib/stock-history/projection';
import { getStockAtOrBefore } from '@/lib/stock-history/query';
import { dateKeyInTz, shiftDateKey } from '@/lib/timezone';
import { evaluateRule, windowStartDateKey, type RuleHit, type RuleTarget } from './evaluate-rule';
import {
  isRuleMetric,
  isRuleScope,
  isRuleWindow,
  isThresholdUnit,
  type TrackingRuleLike,
} from './types';

const HOUR_MS = 60 * 60 * 1000;

interface ProductAgg {
  productId: string;
  productName: string;
  vendorId: string | null;
  variantIds: string[];
  currentStock: number;
  soldByDate: Map<string, number>;
}

/**
 * Merchant'ın etkin takip kurallarını değerlendirir; tetiklenenleri
 * Notification'a (type "rule") yazar, e-posta açık olanları gönderir.
 *
 * Çağrılma: runFullSync sonrası (taze veri) ve saatlik /api/cron/rules.
 * Aynı ürün+kural, kuralın penceresi içinde yeniden bildirilmez (dedupeKey
 * kovası + createdAt cooldown). Hata yutulur — sync'i/cron'u kırmaz.
 *
 * @returns oluşturulan bildirim sayısı
 */
export async function evaluateTrackingRules(merchantId: string, now: Date = new Date()): Promise<number> {
  try {
    const rows = await prisma.trackingRule.findMany({ where: { merchantId, enabled: true } });
    const rules = rows.flatMap(toRuleLike);
    if (rules.length === 0) return 0;

    const settings = await getMerchantSettings(merchantId);
    const todayKey = dateKeyInTz(now, settings.timezone);

    const snapshots = await prisma.productSnapshot.findMany({
      where: { merchantId },
      select: { productId: true, productName: true, vendorId: true, variantId: true, totalStock: true },
    });
    if (snapshots.length === 0) return 0;

    const products = new Map<string, ProductAgg>();
    const variantToProduct = new Map<string, string>();
    for (const s of snapshots) {
      variantToProduct.set(s.variantId, s.productId);
      const p = products.get(s.productId) ?? {
        productId: s.productId,
        productName: s.productName,
        vendorId: s.vendorId,
        variantIds: [],
        currentStock: 0,
        soldByDate: new Map<string, number>(),
      };
      p.variantIds.push(s.variantId);
      p.currentStock += s.totalStock;
      products.set(s.productId, p);
    }

    // Stok düşüşü kuralları: her farklı pencere için "o kadar önce"ki stoklar.
    const dropWindows = Array.from(new Set(rules.filter(r => r.metric === 'stock_drop').map(r => r.windowHours)));
    const previousByWindow = new Map<number, Map<string, number>>();
    await Promise.all(
      dropWindows.map(async h => {
        previousByWindow.set(h, await getStockAtOrBefore(merchantId, new Date(now.getTime() - h * HOUR_MS)));
      }),
    );

    // Satış: en geniş pencere ile 30 günlük hız penceresinin erkeni.
    const maxWindowHours = Math.max(...rules.map(r => r.windowHours));
    const salesFromKey = [windowStartDateKey(todayKey, maxWindowHours), shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1))]
      .sort()[0];
    const sales = await prisma.salesDaily.findMany({
      where: { merchantId, date: { gte: salesFromKey } },
      select: { variantId: true, date: true, quantity: true },
    });
    for (const row of sales) {
      const productId = variantToProduct.get(row.variantId);
      const p = productId ? products.get(productId) : undefined;
      if (!p) continue;
      p.soldByDate.set(row.date, (p.soldByDate.get(row.date) ?? 0) + row.quantity);
    }

    // Cooldown: pencere içinde zaten bildirilen (kural, ürün) çiftleri.
    const recent = await prisma.notification.findMany({
      where: { merchantId, type: 'rule', createdAt: { gte: new Date(now.getTime() - maxWindowHours * HOUR_MS) } },
      select: { ruleId: true, productId: true, createdAt: true },
    });
    const lastNotified = new Map<string, number>();
    for (const n of recent) {
      if (!n.ruleId || !n.productId) continue;
      const key = `${n.ruleId}:${n.productId}`;
      lastNotified.set(key, Math.max(lastNotified.get(key) ?? 0, n.createdAt.getTime()));
    }

    const velocityFromKey = shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1));
    const hits: Array<RuleHit & { emailEnabled: boolean }> = [];
    for (const rule of rules) {
      const previousMap = previousByWindow.get(rule.windowHours);
      const windowFromKey = windowStartDateKey(todayKey, rule.windowHours);
      for (const p of products.values()) {
        const target: RuleTarget = {
          productId: p.productId,
          productName: p.productName,
          vendorId: p.vendorId,
          currentStock: p.currentStock,
          previousStock: previousMap
            ? sumProductPrevious(p.variantIds.map(v => previousMap.get(v) ?? null))
            : null,
          soldInWindow: sumSince(p.soldByDate, windowFromKey),
          soldQty30: sumSince(p.soldByDate, velocityFromKey),
        };
        const hit = evaluateRule(rule, target, now);
        if (!hit) continue;
        const last = lastNotified.get(`${rule.id}:${p.productId}`);
        if (last !== undefined && now.getTime() - last < rule.windowHours * HOUR_MS) continue;
        hits.push({ ...hit, emailEnabled: rule.emailEnabled });
      }
    }

    const created: Array<RuleHit & { emailEnabled: boolean }> = [];
    for (const hit of hits) {
      try {
        await prisma.notification.create({
          data: {
            merchantId,
            type: 'rule',
            ruleId: hit.ruleId,
            title: hit.title,
            body: hit.body,
            productId: hit.productId,
            dedupeKey: hit.dedupeKey,
          },
        });
        created.push(hit);
      } catch {
        // Unique ihlali → bu kovada zaten bildirildi.
      }
    }

    if (created.length > 0) {
      const triggeredRuleIds = Array.from(new Set(created.map(c => c.ruleId)));
      await prisma.trackingRule
        .updateMany({ where: { id: { in: triggeredRuleIds } }, data: { lastTriggeredAt: now } })
        .catch(() => undefined);
      logger.info('Tracking rules triggered', { merchantId, count: created.length });

      const emailHits = created.filter(c => c.emailEnabled);
      if (emailHits.length > 0 && settings.notificationEmail) {
        await sendAlertEmail(
          settings.notificationEmail,
          emailHits.map(h => ({ type: 'rule', title: h.title, body: h.body })),
          { heading: 'Takip Kuralı Uyarıları', subject: `Flowventory: ${emailHits.length} kural uyarısı` },
        ).catch(error => logger.error('Rule email failed', { merchantId, kind: resendErrorKind(error), error }));
      }
    }

    return created.length;
  } catch (error) {
    logger.error('Tracking rule evaluation failed', { merchantId, error });
    return 0;
  }
}

function sumSince(byDate: Map<string, number>, fromKey: string): number {
  let sum = 0;
  for (const [date, qty] of byDate) if (date >= fromKey) sum += qty;
  return sum;
}

/** DB satırını doğrulayıp motor tipine çevirir; bozuk satır (elle yazılmış enum) atlanır. */
function toRuleLike(row: {
  id: string;
  name: string;
  scope: string;
  targetId: string | null;
  targetLabel: string | null;
  metric: string;
  threshold: number;
  thresholdUnit: string;
  windowHours: number;
  emailEnabled: boolean;
}): Array<TrackingRuleLike & { emailEnabled: boolean }> {
  if (!isRuleScope(row.scope) || !isRuleMetric(row.metric) || !isThresholdUnit(row.thresholdUnit) || !isRuleWindow(row.windowHours)) {
    logger.warn('Tracking rule skipped: invalid fields', { ruleId: row.id });
    return [];
  }
  return [{ ...row, scope: row.scope, metric: row.metric, thresholdUnit: row.thresholdUnit, windowHours: row.windowHours }];
}
