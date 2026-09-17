import { logger } from '@/lib/logger';
import { describeOutcome, describeRule } from './describe';
import { conditionsSchema, type RuleInput } from './schema';
import {
  isRuleChannel,
  isRuleDomain,
  isRuleLogic,
  isRuleScope,
  isRuleWindow,
  type RuleChannel,
  type RuleCondition,
  type RuleDomain,
  type RuleLogic,
  type RuleScope,
  type RuleWindowHours,
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
  domain: RuleDomain;
  channel: RuleChannel;
  logic: RuleLogic;
  cooldownHours: RuleWindowHours;
  conditions: RuleCondition[];
  lastTriggeredAt: string | null;
  createdAt: string;
  /** describeRule çıktısı — liste satırı ve bildirim aynı cümleyi kullanır. */
  sentence: string;
  /** describeOutcome çıktısı — kanal + yeniden bildirim aralığı. */
  outcome: string;
};

export type RuleEventItem = {
  id: string;
  productId: string;
  productName: string;
  channel: RuleChannel;
  body: string;
  createdAt: string;
};

export type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  targetId: string | null;
  targetLabel: string | null;
  domain: string;
  channel: string;
  logic: string;
  conditionsJson: string;
  cooldownHours: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

/** `conditionsJson` → doğrulanmış koşul listesi; bozuksa boş (uyarı loglanır). */
export function parseConditions(json: string, ruleId?: string): RuleCondition[] {
  try {
    const parsed = conditionsSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
    logger.warn('Tracking rule conditions invalid', { ruleId, issue: parsed.error.issues[0]?.message });
  } catch (error) {
    logger.warn('Tracking rule conditions unreadable', { ruleId, error });
  }
  return [];
}

/**
 * DB satırını motor tipine çevirir; enum alanı bozuksa (elle yazılmış) null.
 * Koşulları boş olan kural motorda tetiklenmez ama listede görünür.
 */
export function toRuleLike(row: RuleRow): TrackingRuleLike | null {
  if (
    !isRuleScope(row.scope) ||
    !isRuleDomain(row.domain) ||
    !isRuleChannel(row.channel) ||
    !isRuleLogic(row.logic) ||
    !isRuleWindow(row.cooldownHours)
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
    domain: row.domain,
    channel: row.channel,
    logic: row.logic,
    cooldownHours: row.cooldownHours,
    conditions: parseConditions(row.conditionsJson, row.id),
  };
}

/** DB satırı → API öğesi (cümle dahil). Enum alanı bozuksa güvenli varsayılanlara düşer. */
export function toRuleItem(row: RuleRow): TrackingRuleItem {
  const like = toRuleLike(row) ?? {
    id: row.id,
    name: row.name,
    scope: 'all' as const,
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    domain: 'stok' as const,
    channel: 'notification' as const,
    logic: 'and' as const,
    cooldownHours: 24 as const,
    conditions: [],
  };
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    scope: like.scope,
    targetId: like.targetId,
    targetLabel: like.targetLabel,
    domain: like.domain,
    channel: like.channel,
    logic: like.logic,
    cooldownHours: like.cooldownHours,
    conditions: like.conditions,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    sentence: like.conditions.length > 0 ? describeRule(like) : 'Koşullar okunamadı',
    outcome: describeOutcome(like),
  };
}

export function toEventItem(row: {
  id: string;
  productId: string;
  productName: string;
  channel: string;
  body: string;
  createdAt: Date;
}): RuleEventItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    channel: isRuleChannel(row.channel) ? row.channel : 'notification',
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Doğrulanmış gövde → DB satırı alanları (kapsam "all" ise hedef temizlenir). */
export function ruleDataFromInput(input: RuleInput) {
  const { targetId, targetLabel, conditions, ...rest } = input;
  return {
    ...rest,
    targetId: rest.scope === 'all' ? null : targetId ?? null,
    targetLabel: rest.scope === 'all' ? null : targetLabel ?? null,
    conditionsJson: JSON.stringify(conditions),
  };
}
