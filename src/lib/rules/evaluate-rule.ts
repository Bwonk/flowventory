import { evaluateCondition, windowStartDateKey } from './catalog';
import { evaluateNodes } from './logic';
import type { RuleAction, RuleStage, RuleTarget, TrackingRuleLike } from './types';

/**
 * Kural değerlendirmesi — saf. DB'den toplanan hedef durumu (`RuleTarget`),
 * kural ve hedefin aşama durumu verilir; sıradaki aşamanın koşulları
 * bağlaçlarla (VE önce) birleştirilir, sağlanıyorsa aksiyon adayı döner.
 *
 * Aşama ilerlemesi (K2): aşama n tetiklenince hedef n+1'e geçer ve o anki
 * stok/satış kaydedilir; son aşama tetiklenirse orada kalır ve tabanı
 * yenilenir ("her 3 adet daha düşüşte"). Aşama 1 koşulu artık sağlanmıyorsa
 * ya da `resetHours` dolduysa durum başa döner.
 */

export type { RuleTarget };
export { windowStartDateKey };

/** `TrackingRuleState` satırının motorun okuduğu alt kümesi. */
export interface RuleStateLike {
  stageIndex: number;
  stockAtStage: number;
  soldAtStageKey: string;
  soldOnStageDay: number;
  stageFiredAt: Date;
}

export interface RuleHit {
  ruleId: string;
  targetKey: string;
  productId: string;
  variantId: string | null;
  productName: string;
  stageIndex: number;
  title: string;
  body: string;
  actions: RuleAction[];
  dedupeKey: string;
}

export interface RuleEvaluation {
  /** Kayıtlı aşama durumu geçersizleşti — silinmeli (başa dönüş). */
  reset: boolean;
  hit: RuleHit | null;
}

const HOUR_MS = 60 * 60 * 1000;

export function matchesScope(
  rule: Pick<TrackingRuleLike, 'scope' | 'targetId'>,
  target: Pick<RuleTarget, 'productId' | 'vendorId'>,
): boolean {
  switch (rule.scope) {
    case 'product':
      return rule.targetId === target.productId;
    case 'vendor':
      return rule.targetId !== null && rule.targetId === target.vendorId;
    default:
      return true;
  }
}

/** Durum/cooldown anahtarı: ürün düzeyinde productId, varyantta productId:variantId. */
export function targetKeyOf(target: Pick<RuleTarget, 'productId' | 'variantId'>): string {
  return target.variantId ? `${target.productId}:${target.variantId}` : target.productId;
}

/**
 * Kayan pencere için dedupe anahtarı: yeniden çalışma aralığı uzunluğunda
 * kovalar, aşama başına ayrı. Kova sınırındaki çift tetiklemeyi DB tarafındaki
 * cooldown kapatır.
 */
export function buildRuleDedupeKey(
  ruleId: string,
  targetKey: string,
  stageIndex: number,
  now: Date,
  cooldownHours: number,
): string {
  const bucket = Math.floor(now.getTime() / (cooldownHours * HOUR_MS));
  return `rule:${ruleId}:${targetKey}:s${stageIndex}:${bucket}`;
}

/** Aşamanın tetiklendiği günden beri satış; o gün tetikten önce satılanlar düşülür. */
export function soldSinceStage(target: Pick<RuleTarget, 'soldByDate'>, state: RuleStateLike): number {
  let sum = 0;
  for (const [date, qty] of target.soldByDate) if (date >= state.soldAtStageKey) sum += qty;
  return Math.max(0, sum - state.soldOnStageDay);
}

/** Aşama koşulları sağlanıyorsa gövde parçaları, değilse null. */
export function evaluateStage(stage: RuleStage, target: RuleTarget): string[] | null {
  if (stage.conditions.length === 0) return null;
  return evaluateNodes(
    stage.conditions,
    stage.conditions.map(n => evaluateCondition(n.condition, target)),
  );
}

export function evaluateRule(
  rule: TrackingRuleLike,
  target: RuleTarget,
  state: RuleStateLike | null,
  now: Date,
): RuleEvaluation {
  const stages = rule.workflow.stages;
  if (stages.length === 0 || !matchesScope(rule, target)) return { reset: false, hit: null };

  let stageIndex = state ? Math.min(Math.max(0, state.stageIndex), stages.length - 1) : 0;
  let reset = false;
  if (state && stageIndex > 0) {
    const expired = now.getTime() - state.stageFiredAt.getTime() >= rule.resetHours * HOUR_MS;
    if (expired || evaluateStage(stages[0], target) === null) {
      reset = true;
      stageIndex = 0;
    }
  }

  const stageTarget: RuleTarget =
    state && stageIndex > 0
      ? { ...target, stage: { stockAtStage: state.stockAtStage, soldSinceStage: soldSinceStage(target, state) } }
      : target;
  const bodies = evaluateStage(stages[stageIndex], stageTarget);
  if (!bodies) return { reset, hit: null };

  const targetKey = targetKeyOf(target);
  return {
    reset,
    hit: {
      ruleId: rule.id,
      targetKey,
      productId: target.productId,
      variantId: target.variantId,
      productName: target.productName,
      stageIndex,
      title: stages.length > 1 ? `${target.productName} — ${rule.name} (aşama ${stageIndex + 1})` : `${target.productName} — ${rule.name}`,
      body: bodies.join(' '),
      actions: stages[stageIndex].actions,
      dedupeKey: buildRuleDedupeKey(rule.id, targetKey, stageIndex, now, rule.cooldownHours),
    },
  };
}

/**
 * Tetik sonrası aşama durumu. Tek aşamalı kuralda durum tutulmaz (null) —
 * yeniden çalışmayı yalnız cooldown sınırlar. `stockAfter` verilirse (stok
 * aksiyonu yazdı) taban yazım sonrası stoktur.
 */
export function nextState(
  rule: Pick<TrackingRuleLike, 'workflow'>,
  target: Pick<RuleTarget, 'currentStock' | 'soldByDate' | 'todayKey'>,
  hit: Pick<RuleHit, 'stageIndex'>,
  now: Date,
  stockAfter?: number,
): RuleStateLike | null {
  const count = rule.workflow.stages.length;
  if (count <= 1) return null;
  return {
    stageIndex: Math.min(hit.stageIndex + 1, count - 1),
    stockAtStage: stockAfter ?? target.currentStock,
    soldAtStageKey: target.todayKey,
    soldOnStageDay: target.soldByDate.get(target.todayKey) ?? 0,
    stageFiredAt: now,
  };
}
