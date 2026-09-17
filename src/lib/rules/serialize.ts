import { logger } from '@/lib/logger';
import { describeActionSummary, describeRule } from './describe';
import { storedWorkflowSchema, type RuleInput } from './schema';
import {
  isRuleGranularity,
  isRuleScope,
  isRuleWindow,
  RULE_ACTION_TYPES,
  type RuleActionResult,
  type RuleActionType,
  type RuleGranularity,
  type RuleScope,
  type RuleWindowHours,
  type RuleWorkflow,
  type TrackingRuleLike,
} from './types';

/** Merchant başına kural üst sınırı — değerlendirme maliyetini sınırlar. */
export const MAX_RULES_PER_MERCHANT = 50;

export type TrackingRuleItem = {
  id: string;
  name: string;
  enabled: boolean;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  granularity: RuleGranularity;
  workflow: RuleWorkflow;
  cooldownHours: RuleWindowHours;
  resetHours: RuleWindowHours;
  maxRunsPerDay: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  /** describeRule çıktısı — liste satırı ve önizleme aynı cümleyi kullanır. */
  sentence: string;
  /** Liste kolonu: "Bildirim · Stok +5". */
  actionSummary: string;
  /** Liste ikonları için aşamalar boyunca tekrarsız aksiyon tipleri. */
  actionTypes: RuleActionType[];
};

export type RuleEventItem = {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  stageIndex: number;
  body: string;
  actions: RuleActionResult[];
  createdAt: string;
};

export type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  targetId: string | null;
  targetLabel: string | null;
  granularity: string;
  workflowJson: string;
  cooldownHours: number;
  resetHours: number;
  maxRunsPerDay: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

const EMPTY_WORKFLOW: RuleWorkflow = { stages: [] };

/** `workflowJson` → doğrulanmış workflow; bozuksa aşamasız (uyarı loglanır). */
export function parseWorkflow(json: string, ruleId?: string): RuleWorkflow {
  try {
    const parsed = storedWorkflowSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
    logger.warn('Tracking rule workflow invalid', { ruleId, issue: parsed.error.issues[0]?.message });
  } catch (error) {
    logger.warn('Tracking rule workflow unreadable', { ruleId, error });
  }
  return EMPTY_WORKFLOW;
}

/**
 * DB satırını motor tipine çevirir; enum alanı bozuksa (elle yazılmış) null.
 * Aşaması olmayan kural motorda tetiklenmez ama listede görünür.
 */
export function toRuleLike(row: RuleRow): TrackingRuleLike | null {
  if (
    !isRuleScope(row.scope) ||
    !isRuleGranularity(row.granularity) ||
    !isRuleWindow(row.cooldownHours) ||
    !isRuleWindow(row.resetHours)
  ) {
    logger.warn('Tracking rule skipped: invalid fields', { ruleId: row.id });
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    granularity: row.granularity,
    workflow: parseWorkflow(row.workflowJson, row.id),
    cooldownHours: row.cooldownHours,
    resetHours: row.resetHours,
    maxRunsPerDay: Math.max(1, row.maxRunsPerDay),
  };
}

/** DB satırı → API öğesi (cümle dahil). Enum alanı bozuksa güvenli varsayılanlara düşer. */
export function toRuleItem(row: RuleRow): TrackingRuleItem {
  const like: TrackingRuleLike = toRuleLike(row) ?? {
    id: row.id,
    name: row.name,
    scope: 'all',
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    granularity: 'product',
    workflow: EMPTY_WORKFLOW,
    cooldownHours: 24,
    resetHours: 168,
    maxRunsPerDay: 1,
  };
  const actionTypes = RULE_ACTION_TYPES.filter(t => like.workflow.stages.some(s => s.actions.some(a => a.type === t)));
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    scope: like.scope,
    targetId: like.targetId,
    targetLabel: like.targetLabel,
    granularity: like.granularity,
    workflow: like.workflow,
    cooldownHours: like.cooldownHours,
    resetHours: like.resetHours,
    maxRunsPerDay: like.maxRunsPerDay,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    sentence: like.workflow.stages.length > 0 ? describeRule(like) : 'Koşullar okunamadı',
    actionSummary: describeActionSummary(like.workflow),
    actionTypes,
  };
}

/** `actionsJson` → sonuç listesi; bozuk öğeler atlanır. */
export function parseActionResults(json: string): RuleActionResult[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is RuleActionResult =>
        typeof r === 'object' &&
        r !== null &&
        (RULE_ACTION_TYPES as readonly unknown[]).includes((r as RuleActionResult).type) &&
        typeof (r as RuleActionResult).ok === 'boolean',
    );
  } catch {
    return [];
  }
}

export function toEventItem(row: {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  stageIndex: number;
  body: string;
  actionsJson: string;
  createdAt: Date;
}): RuleEventItem {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    productName: row.productName,
    stageIndex: row.stageIndex,
    body: row.body,
    actions: parseActionResults(row.actionsJson),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Doğrulanmış gövde → DB satırı alanları. Kapsam "all" ise hedef temizlenir;
 * onay bayrağı saklanmaz.
 */
export function ruleDataFromInput(input: RuleInput) {
  const { targetId, targetLabel, workflow, stockWriteConsent: _consent, ...rest } = input;
  void _consent;
  return {
    ...rest,
    targetId: rest.scope === 'all' ? null : targetId ?? null,
    targetLabel: rest.scope === 'all' ? null : targetLabel ?? null,
    workflowJson: JSON.stringify(workflow),
  };
}
