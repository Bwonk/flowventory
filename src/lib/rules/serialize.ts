import { describeRule } from './describe';
import type { RuleMetric, RuleScope, RuleWindowHours, ThresholdUnit } from './types';

/** Merchant başına kural üst sınırı — değerlendirme maliyetini sınırlar. */
export const MAX_RULES_PER_MERCHANT = 50;

export type TrackingRuleItem = {
  id: string;
  name: string;
  enabled: boolean;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  metric: RuleMetric;
  threshold: number;
  thresholdUnit: ThresholdUnit;
  windowHours: RuleWindowHours;
  emailEnabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  /** describeRule çıktısı — liste satırı ve bildirim aynı cümleyi kullanır. */
  sentence: string;
};

type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  targetId: string | null;
  targetLabel: string | null;
  metric: string;
  threshold: number;
  thresholdUnit: string;
  windowHours: number;
  emailEnabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

/** DB satırı → API öğesi (cümle dahil). Enum alanları şema ile yazıldığı için doğrudan daraltılır. */
export function toRuleItem(row: RuleRow): TrackingRuleItem {
  const typed = {
    scope: row.scope as RuleScope,
    metric: row.metric as RuleMetric,
    thresholdUnit: row.thresholdUnit as ThresholdUnit,
    windowHours: row.windowHours as RuleWindowHours,
  };
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    threshold: row.threshold,
    emailEnabled: row.emailEnabled,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...typed,
    sentence: describeRule({ ...typed, targetId: row.targetId, targetLabel: row.targetLabel, threshold: row.threshold }),
  };
}
