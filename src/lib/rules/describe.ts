import { describeAction, shortActionLabel, workflowActions } from './actions-catalog';
import { describeCondition } from './catalog';
import { describeNodes, joinClauses } from './logic';
import type { RuleStage, RuleWindowHours, RuleWorkflow, TrackingRuleLike } from './types';

export { describeAction, describeCondition, joinClauses };

/**
 * Kuralı cümleyle anlatır — oluşturucu önizlemesi, liste satırı ve e-posta
 * aynı metni kullanır: "Tüm ürünler için stok 10 adedin altına inerse:
 * bildirim gönder ve stoğu 5 artır. Sonra stok 3 adet daha düşerse: e-posta gönder."
 */
export function describeRule(rule: Pick<TrackingRuleLike, 'scope' | 'targetLabel' | 'workflow'>): string {
  const stages = rule.workflow.stages.filter(s => s.conditions.length > 0);
  if (stages.length === 0) return `${describeScope(rule)} koşul tanımlanmadı`;
  return stages
    .map((stage, i) => (i === 0 ? `${describeScope(rule)} ${describeStage(stage)}` : `Sonra ${describeStage(stage)}`))
    .join(' ');
}

/** "stok 10 adedin altına inerse: bildirim gönder." */
export function describeStage(stage: RuleStage): string {
  const when = describeStageConditions(stage);
  if (stage.actions.length === 0) return `${when}: aksiyon seçilmedi.`;
  return `${when}: ${joinClauses(stage.actions.map(describeAction), 'and')}.`;
}

export function describeStageConditions(stage: Pick<RuleStage, 'conditions'>): string {
  return describeNodes(
    stage.conditions,
    stage.conditions.map(n => describeCondition(n.condition)),
  );
}

export function describeScope(rule: Pick<TrackingRuleLike, 'scope' | 'targetLabel'>): string {
  switch (rule.scope) {
    case 'product':
      return `${rule.targetLabel ?? 'Seçili ürün'} için`;
    case 'vendor':
      return `${rule.targetLabel ?? 'Seçili tedarikçi'} ürünlerinde`;
    default:
      return 'Tüm ürünler için';
  }
}

/** Liste kolonu: "Bildirim · Stok +5 · E-posta" — aşamalar boyunca, tekrarsız. */
export function describeActionSummary(workflow: RuleWorkflow): string {
  return Array.from(new Set(workflowActions(workflow).map(shortActionLabel))).join(' · ');
}

/** "24 saatte", "7 günde" — aralıklar için bulunma hâli. */
const WINDOW_LOCATIVE: Record<RuleWindowHours, string> = {
  24: '24 saatte',
  48: '48 saatte',
  168: '7 günde',
  720: '30 günde',
  2160: '90 günde',
};

/** Çalışma ayarları özeti: "aynı varyant için en fazla 24 saatte bir". */
export function describeCadence(rule: Pick<TrackingRuleLike, 'cooldownHours' | 'granularity'>): string {
  const every = WINDOW_LOCATIVE[rule.cooldownHours] ?? `${rule.cooldownHours} saatte`;
  return `aynı ${rule.granularity === 'variant' ? 'varyant' : 'ürün'} için en fazla ${every} bir`;
}
