import { sendAlertEmail } from '@/lib/alerts/email';
import { resendErrorKind } from '@/lib/email/resend-error';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { classifyAbc, type AbcClass } from '@/lib/reports/abc';
import { sumProductPrevious } from '@/lib/stock-history/change';
import { VELOCITY_WINDOW_DAYS } from '@/lib/stock-history/projection';
import { getStockAtOrBefore } from '@/lib/stock-history/query';
import { dateKeyInTz, shiftDateKey } from '@/lib/timezone';
import { windowStartDateKey } from './catalog';
import { evaluateRule, type RuleHit } from './evaluate-rule';
import { toRuleLike } from './serialize';
import type { RuleTarget, RuleWindowHours, TrackingRuleLike } from './types';

const HOUR_MS = 60 * 60 * 1000;
/** Satış verisi bu kadar geriye okunur (en geniş pencere 90 gün). */
const SALES_LOOKBACK_DAYS = 90;

interface ProductAgg {
  productId: string;
  productName: string;
  vendorId: string | null;
  variantIds: string[];
  currentStock: number;
  soldByDate: Map<string, number>;
  revenue30: number;
}

/**
 * Merchant'ın etkin takip kurallarını değerlendirir. Her tetik
 * TrackingRuleEvent'e yazılır (dedupe + cooldown + geçmiş); kanal
 * "notification" ise Notification (zil), "email" ise e-posta.
 *
 * Çağrılma: runFullSync sonrası (taze veri) ve saatlik /api/cron/rules.
 * Aynı ürün+kural, kuralın cooldownHours'u içinde yeniden bildirilmez.
 * Hata yutulur — sync'i/cron'u kırmaz.
 *
 * @returns oluşturulan tetik (event) sayısı
 */
export async function evaluateTrackingRules(merchantId: string, now: Date = new Date()): Promise<number> {
  try {
    const rows = await prisma.trackingRule.findMany({ where: { merchantId, enabled: true } });
    const rules = rows.map(toRuleLike).filter((r): r is TrackingRuleLike => r !== null && r.conditions.length > 0);
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
        revenue30: 0,
      };
      p.variantIds.push(s.variantId);
      p.currentStock += s.totalStock;
      products.set(s.productId, p);
    }

    // Stok düşüşü koşulları: her farklı pencere için "o kadar önce"ki stoklar.
    const dropWindows = Array.from(
      new Set(
        rules.flatMap(r => r.conditions.flatMap(c => (c.metric === 'stock_drop' ? [c.windowHours] : []))),
      ),
    );
    const previousByWindow = new Map<RuleWindowHours, Map<string, number>>();
    await Promise.all(
      dropWindows.map(async h => {
        previousByWindow.set(h, await getStockAtOrBefore(merchantId, new Date(now.getTime() - h * HOUR_MS)));
      }),
    );

    // Satış: 90 gün geriye (en geniş ölçüm penceresi); ciro yalnız ABC için.
    const velocityFromKey = shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1));
    const salesFromKey = shiftDateKey(todayKey, -(SALES_LOOKBACK_DAYS - 1));
    const sales = await prisma.salesDaily.findMany({
      where: { merchantId, date: { gte: salesFromKey } },
      select: { variantId: true, date: true, quantity: true, revenue: true },
    });
    for (const row of sales) {
      const productId = variantToProduct.get(row.variantId);
      const p = productId ? products.get(productId) : undefined;
      if (!p) continue;
      p.soldByDate.set(row.date, (p.soldByDate.get(row.date) ?? 0) + row.quantity);
      if (row.date >= velocityFromKey) p.revenue30 += row.revenue;
    }

    // ABC yalnız ihtiyaç duyan kural varsa (mağaza geneli tek sıralama).
    const needsAbc = rules.some(r => r.conditions.some(c => c.metric === 'abc_class_is' || c.metric === 'action_is'));
    const abcByProduct: Map<string, AbcClass> | null = needsAbc
      ? classifyAbc(Array.from(products.values()).map(p => ({ id: p.productId, revenue: p.revenue30 })))
      : null;

    // Cooldown: aralık içinde zaten tetiklenen (kural, ürün) çiftleri — kanal fark etmez.
    const maxCooldown = Math.max(...rules.map(r => r.cooldownHours));
    const recent = await prisma.trackingRuleEvent.findMany({
      where: { merchantId, createdAt: { gte: new Date(now.getTime() - maxCooldown * HOUR_MS) } },
      select: { ruleId: true, productId: true, createdAt: true },
    });
    const lastTriggered = new Map<string, number>();
    for (const e of recent) {
      const key = `${e.ruleId}:${e.productId}`;
      lastTriggered.set(key, Math.max(lastTriggered.get(key) ?? 0, e.createdAt.getTime()));
    }

    const dayKeys = Array.from({ length: VELOCITY_WINDOW_DAYS }, (_, i) =>
      shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1 - i)),
    );
    const targets: RuleTarget[] = Array.from(products.values()).map(p => ({
      productId: p.productId,
      productName: p.productName,
      vendorId: p.vendorId,
      currentStock: p.currentStock,
      previousStockByWindow: new Map(
        dropWindows.map(h => [
          h,
          sumProductPrevious(p.variantIds.map(v => previousByWindow.get(h)?.get(v) ?? null)),
        ]),
      ),
      soldByDate: p.soldByDate,
      soldQty30: dayKeys.reduce((sum, k) => sum + (p.soldByDate.get(k) ?? 0), 0),
      dailyQuantities: dayKeys.map(k => p.soldByDate.get(k) ?? 0),
      abcClass: abcByProduct?.get(p.productId) ?? null,
      leadTimeDays: settings.leadTimeDays,
      targetStockDays: settings.targetStockDays,
      todayKey,
    }));

    const hits: Array<RuleHit & { rule: TrackingRuleLike }> = [];
    for (const rule of rules) {
      for (const target of targets) {
        const hit = evaluateRule(rule, target, now);
        if (!hit) continue;
        const last = lastTriggered.get(`${rule.id}:${target.productId}`);
        if (last !== undefined && now.getTime() - last < rule.cooldownHours * HOUR_MS) continue;
        hits.push({ ...hit, rule });
      }
    }

    const created: Array<RuleHit & { rule: TrackingRuleLike }> = [];
    for (const hit of hits) {
      try {
        await prisma.trackingRuleEvent.create({
          data: {
            merchantId,
            ruleId: hit.ruleId,
            productId: hit.productId,
            productName: hit.productName,
            channel: hit.rule.channel,
            body: hit.body,
            dedupeKey: hit.dedupeKey,
          },
        });
        created.push(hit);
      } catch {
        // Unique ihlali → bu kovada zaten tetiklendi.
      }
    }
    if (created.length === 0) return 0;

    // Zil: yalnız "notification" kanalı. Aynı dedupeKey — Notification tablosunda da tekildir.
    for (const hit of created.filter(h => h.rule.channel === 'notification')) {
      await prisma.notification
        .create({
          data: {
            merchantId,
            type: 'rule',
            ruleId: hit.ruleId,
            title: hit.title,
            body: hit.body,
            productId: hit.productId,
            dedupeKey: hit.dedupeKey,
          },
        })
        .catch(() => undefined);
    }

    await prisma.trackingRule
      .updateMany({ where: { id: { in: Array.from(new Set(created.map(c => c.ruleId))) } }, data: { lastTriggeredAt: now } })
      .catch(() => undefined);
    logger.info('Tracking rules triggered', { merchantId, count: created.length });

    const emailHits = created.filter(h => h.rule.channel === 'email');
    if (emailHits.length > 0) {
      if (!settings.notificationEmail) {
        logger.warn('Email rule triggered but no notification email set', { merchantId, count: emailHits.length });
      } else {
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

/** Kural tetik geçmişini budar (bakım; hata yutulur). */
export async function pruneRuleEvents(olderThanDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.trackingRuleEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) logger.info('Rule events pruned', { count, olderThanDays });
    return count;
  } catch (error) {
    logger.warn('Rule events prune failed', { error });
    return 0;
  }
}

export { windowStartDateKey };
