import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { classifyAbc, type AbcClass } from '@/lib/reports/abc';
import { sumProductPrevious } from '@/lib/stock-history/change';
import { VELOCITY_WINDOW_DAYS } from '@/lib/stock-history/projection';
import { getStockAtOrBefore } from '@/lib/stock-history/query';
import { dateKeyInTz, shiftDateKey } from '@/lib/timezone';
import type { AuthToken } from '@/models/auth-token';
import { adjustStockAction } from './actions/adjust-stock';
import { sendRuleEmails } from './actions/email';
import { createRuleNotification } from './actions/notify';
import { windowStartDateKey } from './catalog';
import { evaluateRule, nextState, targetKeyOf, type RuleHit } from './evaluate-rule';
import { parseActionResults, toRuleLike } from './serialize';
import type { RuleActionResult, RuleTarget, RuleWindowHours, TrackingRuleLike } from './types';

const HOUR_MS = 60 * 60 * 1000;
/** Satış verisi bu kadar geriye okunur (en geniş pencere 90 gün). */
const SALES_LOOKBACK_DAYS = 90;
/** Aşama durumu bu kadar eskiyse budanır (en uzun resetHours = 90 gün). */
const STATE_RETENTION_DAYS = 90;

interface Agg {
  productId: string;
  variantId: string | null;
  productName: string;
  vendorId: string | null;
  variantIds: string[];
  currentStock: number;
  soldByDate: Map<string, number>;
  revenue30: number;
}

const fmt = (n: number) => n.toLocaleString('tr-TR');

function variantLabel(json: string | null): string {
  if (!json) return '';
  try {
    const values: unknown = JSON.parse(json);
    if (!Array.isArray(values)) return '';
    return values
      .map(v => (typeof v === 'object' && v !== null && 'valueName' in v ? String(v.valueName) : ''))
      .filter(Boolean)
      .join(' / ');
  } catch {
    return '';
  }
}

/**
 * Merchant'ın etkin takip kurallarını değerlendirir ve aksiyonları çalıştırır.
 * Sıra (tetik başına): event create (dedupe) → stok aksiyonu → bildirim →
 * aşama durumu; e-postalar turun sonunda tek e-postada. Her aksiyonun sonucu
 * `TrackingRuleEvent.actionsJson`'a yazılır.
 *
 * Çağrılma: runFullSync sonrası (taze veri) ve saatlik /api/cron/rules.
 * `authToken` yoksa stok aksiyonu başarısız işlenir, diğerleri çalışır.
 * Hata yutulur — sync'i/cron'u kırmaz.
 *
 * Sonsuz döngü notu: stok yazımı → ikas webhook → refreshProductSnapshot
 * (kural değerlendirmez) → bir sonraki tam turda yeniden değerlendirme;
 * cooldown + maxRunsPerDay sınırlar.
 *
 * @returns oluşturulan tetik (event) sayısı
 */
export async function evaluateTrackingRules(
  merchantId: string,
  authToken: AuthToken | null,
  now: Date = new Date(),
): Promise<number> {
  try {
    const rows = await prisma.trackingRule.findMany({ where: { merchantId, enabled: true } });
    const rules = rows
      .map(toRuleLike)
      .filter((r): r is TrackingRuleLike => r !== null && r.workflow.stages.length > 0);
    if (rules.length === 0) return 0;

    const settings = await getMerchantSettings(merchantId);
    const todayKey = dateKeyInTz(now, settings.timezone);
    const needsVariants = rules.some(r => r.granularity === 'variant');

    const snapshots = await prisma.productSnapshot.findMany({
      where: { merchantId },
      select: { productId: true, productName: true, vendorId: true, variantId: true, totalStock: true, variantValuesJson: true },
    });
    if (snapshots.length === 0) return 0;

    const products = new Map<string, Agg>();
    const variants = new Map<string, Agg>();
    for (const s of snapshots) {
      const p = products.get(s.productId) ?? {
        productId: s.productId,
        variantId: null,
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
      if (needsVariants) {
        const label = variantLabel(s.variantValuesJson);
        variants.set(s.variantId, {
          productId: s.productId,
          variantId: s.variantId,
          productName: label ? `${s.productName} · ${label}` : s.productName,
          vendorId: s.vendorId,
          variantIds: [s.variantId],
          currentStock: s.totalStock,
          soldByDate: new Map<string, number>(),
          revenue30: 0,
        });
      }
    }

    // Stok düşüşü koşulları: her farklı pencere için "o kadar önce"ki varyant stokları.
    const dropWindows = Array.from(
      new Set(
        rules.flatMap(r =>
          r.workflow.stages.flatMap(s => s.conditions.flatMap(n => (n.condition.metric === 'stock_drop' ? [n.condition.windowHours] : []))),
        ),
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
    const variantToProduct = new Map(snapshots.map(s => [s.variantId, s.productId]));
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
      const v = variants.get(row.variantId);
      if (v) v.soldByDate.set(row.date, (v.soldByDate.get(row.date) ?? 0) + row.quantity);
    }

    // ABC yalnız ihtiyaç duyan kural varsa (mağaza geneli, ürün düzeyinde tek sıralama).
    const needsAbc = rules.some(r =>
      r.workflow.stages.some(s => s.conditions.some(n => n.condition.metric === 'abc_class_is' || n.condition.metric === 'action_is')),
    );
    const abcByProduct: Map<string, AbcClass> | null = needsAbc
      ? classifyAbc(Array.from(products.values()).map(p => ({ id: p.productId, revenue: p.revenue30 })))
      : null;

    const dayKeys = Array.from({ length: VELOCITY_WINDOW_DAYS }, (_, i) =>
      shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1 - i)),
    );
    const toTarget = (a: Agg): RuleTarget => ({
      productId: a.productId,
      variantId: a.variantId,
      productName: a.productName,
      vendorId: a.vendorId,
      currentStock: a.currentStock,
      previousStockByWindow: new Map(
        dropWindows.map(h => [h, sumProductPrevious(a.variantIds.map(v => previousByWindow.get(h)?.get(v) ?? null))]),
      ),
      soldByDate: a.soldByDate,
      soldQty30: dayKeys.reduce((sum, k) => sum + (a.soldByDate.get(k) ?? 0), 0),
      dailyQuantities: dayKeys.map(k => a.soldByDate.get(k) ?? 0),
      abcClass: abcByProduct?.get(a.productId) ?? null,
      leadTimeDays: settings.leadTimeDays,
      targetStockDays: settings.targetStockDays,
      todayKey,
    });
    const productTargets = Array.from(products.values()).map(toTarget);
    const variantTargets = needsVariants ? Array.from(variants.values()).map(toTarget) : [];

    // Aşama durumları.
    const ruleIds = rules.map(r => r.id);
    const stateRows = await prisma.trackingRuleState.findMany({ where: { merchantId, ruleId: { in: ruleIds } } });
    const states = new Map(stateRows.map(s => [`${s.ruleId}:${s.targetKey}`, s]));

    // Cooldown (kural + hedef + aşama) ve günlük stok yazımı sayacı (kural + hedef).
    const lookbackHours = Math.max(24, ...rules.map(r => r.cooldownHours));
    const recent = await prisma.trackingRuleEvent.findMany({
      where: { merchantId, ruleId: { in: ruleIds }, createdAt: { gte: new Date(now.getTime() - lookbackHours * HOUR_MS) } },
      select: { ruleId: true, productId: true, variantId: true, stageIndex: true, actionsJson: true, createdAt: true },
    });
    const lastFired = new Map<string, number>();
    const stockRuns = new Map<string, number>();
    for (const e of recent) {
      const targetKey = targetKeyOf(e);
      const stageKey = `${e.ruleId}:${targetKey}:${e.stageIndex}`;
      lastFired.set(stageKey, Math.max(lastFired.get(stageKey) ?? 0, e.createdAt.getTime()));
      if (now.getTime() - e.createdAt.getTime() < 24 * HOUR_MS) {
        const wrote = parseActionResults(e.actionsJson).some(a => a.type === 'adjust_stock' && a.ok);
        if (wrote) stockRuns.set(`${e.ruleId}:${targetKey}`, (stockRuns.get(`${e.ruleId}:${targetKey}`) ?? 0) + 1);
      }
    }

    const resets: Array<{ ruleId: string; targetKey: string }> = [];
    const hits: Array<{ hit: RuleHit; rule: TrackingRuleLike; target: RuleTarget }> = [];
    for (const rule of rules) {
      for (const target of rule.granularity === 'variant' ? variantTargets : productTargets) {
        const targetKey = targetKeyOf(target);
        const { reset, hit } = evaluateRule(rule, target, states.get(`${rule.id}:${targetKey}`) ?? null, now);
        if (reset) resets.push({ ruleId: rule.id, targetKey });
        if (!hit) continue;
        const last = lastFired.get(`${rule.id}:${targetKey}:${hit.stageIndex}`);
        if (last !== undefined && now.getTime() - last < rule.cooldownHours * HOUR_MS) continue;
        hits.push({ hit, rule, target });
      }
    }

    for (const r of resets) {
      await prisma.trackingRuleState.deleteMany({ where: { ruleId: r.ruleId, targetKey: r.targetKey } }).catch(() => undefined);
    }

    const created: Array<{ eventId: string; hit: RuleHit; results: RuleActionResult[]; body: string }> = [];
    const emailQueue: Array<{ eventId: string; title: string; body: string }> = [];

    for (const { hit, rule, target } of hits) {
      let eventId: string;
      try {
        const event = await prisma.trackingRuleEvent.create({
          data: {
            merchantId,
            ruleId: hit.ruleId,
            productId: hit.productId,
            variantId: hit.variantId,
            productName: hit.productName,
            stageIndex: hit.stageIndex,
            body: hit.body,
            dedupeKey: hit.dedupeKey,
          },
          select: { id: true },
        });
        eventId = event.id;
      } catch {
        // Unique ihlali → bu kovada zaten tetiklendi.
        continue;
      }

      const results: RuleActionResult[] = [];
      let body = hit.body;
      let stockAfter: number | undefined;

      // 1) Stok yazımı önce: bildirim/e-posta sonucu anlatabilsin.
      const stockAction = hit.actions.find(a => a.type === 'adjust_stock');
      if (stockAction) {
        const runKey = `${hit.ruleId}:${hit.targetKey}`;
        const result = await adjustStockAction(
          {
            merchantId,
            authToken,
            productId: hit.productId,
            variantId: hit.variantId,
            runsToday: stockRuns.get(runKey) ?? 0,
            maxRunsPerDay: rule.maxRunsPerDay,
          },
          stockAction,
        );
        results.push(result);
        if (result.ok && result.stock) {
          stockRuns.set(runKey, (stockRuns.get(runKey) ?? 0) + 1);
          stockAfter = target.currentStock + (result.stock.newCount - result.stock.previousCount);
          body = `${body} Kural stoğu ${fmt(target.currentStock)} → ${fmt(stockAfter)} yaptı; kural geçmişinden geri alabilirsiniz.`;
        } else {
          body = `${body} Stok yazılamadı: ${result.detail}.`;
        }
      }

      // 2) Bildirim. Stok yazıldıysa bildirim aksiyonu olmasa da zorunlu bilgilendirme (K5).
      const notify = { ruleId: hit.ruleId, productId: hit.productId, title: hit.title, body, dedupeKey: hit.dedupeKey };
      if (hit.actions.some(a => a.type === 'notify')) {
        results.push(await createRuleNotification(merchantId, notify));
      } else if (stockAfter !== undefined) {
        await createRuleNotification(merchantId, { ...notify, title: `${rule.name}: stok güncellendi`, dedupeKey: `${hit.dedupeKey}:stock` });
      }

      // 3) E-posta turun sonunda toplu.
      if (hit.actions.some(a => a.type === 'email')) emailQueue.push({ eventId, title: hit.title, body });

      // 4) Aşama durumu.
      const next = nextState(rule, target, hit, now, stockAfter);
      if (next) {
        await prisma.trackingRuleState
          .upsert({
            where: { ruleId_targetKey: { ruleId: hit.ruleId, targetKey: hit.targetKey } },
            create: { merchantId, ruleId: hit.ruleId, targetKey: hit.targetKey, ...next },
            update: next,
          })
          .catch(error => logger.warn('Rule state update failed', { merchantId, ruleId: hit.ruleId, error }));
      }

      created.push({ eventId, hit, results, body });
    }
    if (created.length === 0) return 0;

    if (emailQueue.length > 0) {
      const emailResult = await sendRuleEmails(merchantId, settings.notificationEmail, emailQueue);
      const queued = new Set(emailQueue.map(e => e.eventId));
      for (const c of created) if (queued.has(c.eventId)) c.results.push(emailResult);
    }

    for (const c of created) {
      await prisma.trackingRuleEvent
        .update({ where: { id: c.eventId }, data: { body: c.body, actionsJson: JSON.stringify(c.results) } })
        .catch(error => logger.warn('Rule event results update failed', { merchantId, eventId: c.eventId, error }));
    }

    await prisma.trackingRule
      .updateMany({ where: { id: { in: Array.from(new Set(created.map(c => c.hit.ruleId))) } }, data: { lastTriggeredAt: now } })
      .catch(() => undefined);
    logger.info('Tracking rules triggered', { merchantId, count: created.length });

    return created.length;
  } catch (error) {
    logger.error('Tracking rule evaluation failed', { merchantId, error });
    return 0;
  }
}

/** Kural tetik geçmişini ve bayat aşama durumlarını budar (bakım; hata yutulur). */
export async function pruneRuleEvents(olderThanDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.trackingRuleEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    const stateCutoff = new Date(Date.now() - STATE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.trackingRuleState.deleteMany({ where: { stageFiredAt: { lt: stateCutoff } } });
    if (count > 0) logger.info('Rule events pruned', { count, olderThanDays });
    return count;
  } catch (error) {
    logger.warn('Rule events prune failed', { error });
    return 0;
  }
}

export { windowStartDateKey };
