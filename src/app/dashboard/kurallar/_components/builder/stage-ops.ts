// Aşama ekleme/çıkarma kuralları — React'siz saf fonksiyonlar (vitest ile sınanır).
import { MAX_STAGES, type ConditionNode, type RuleAction, type RuleWorkflow } from '@/lib/rules/types';

/**
 * İstemci anahtarı: oluşturucudaki her aşama/koşul/aksiyonun kararlı kimliği —
 * yalnız React `key` içindir (indeksle anahtarlanınca 0. kart kaldırılınca çıkış
 * son kartta oynuyor, yanlış kartın state'i kalıyordu). API'ye gitmez: `stripKeys`.
 */
type Keyed<T> = T & { key: string };
export type BuilderConditionNode = Keyed<ConditionNode>;
export type BuilderAction = Keyed<RuleAction>;
export interface BuilderStage {
  key: string;
  conditions: BuilderConditionNode[];
  actions: BuilderAction[];
}
export interface BuilderWorkflow {
  stages: BuilderStage[];
}

let seq = 0;
/** Oturum içinde tekil anahtar (crypto.randomUUID güvenli olmayan bağlamda yok). */
export function newKey(): string {
  seq += 1;
  return `k${seq}`;
}

export function keyAction(action: RuleAction): BuilderAction {
  return { ...action, key: newKey() };
}

export function keyCondition(node: ConditionNode): BuilderConditionNode {
  return { ...node, key: newKey() };
}

/** Sunucudan/şablondan gelen workflow'a anahtar ekler. */
export function withKeys(workflow: RuleWorkflow): BuilderWorkflow {
  return {
    stages: workflow.stages.map(s => ({ key: newKey(), conditions: s.conditions.map(keyCondition), actions: s.actions.map(keyAction) })),
  };
}

/** Kayıt/karşılaştırma için anahtarları söker — API gövdesi eski biçimde kalır. */
export function stripKeys(workflow: BuilderWorkflow): RuleWorkflow {
  return {
    stages: workflow.stages.map(s => ({
      conditions: s.conditions.map(({ op, condition }) => ({ op, condition })),
      actions: s.actions.map(({ key: _key, ...action }) => action as RuleAction),
    })),
  };
}

/** Aşama 1 kaldırılamaz: sonraki aşamalar "önceki aşamaya" göre ölçer. Geçersiz istekte aynı dizi döner. */
export function removeStageAt<S>(stages: readonly S[], index: number): readonly S[] {
  if (index <= 0 || index >= stages.length) return stages;
  return stages.filter((_, i) => i !== index);
}

/**
 * "Geri al": kaldırılan aşamayı eski sırasına koyar. Arada başka aşamalar da
 * kaldırıldıysa sona eklenir; aşama sınırı dolduysa ya da ilk sıraya istenirse
 * aynı dizi döner (çağıran bunu "geri alınamadı" diye bildirir).
 */
export function restoreStageAt<S>(stages: readonly S[], index: number, stage: S): readonly S[] {
  if (index <= 0 || stages.length >= MAX_STAGES) return stages;
  const at = Math.min(index, stages.length);
  return [...stages.slice(0, at), stage, ...stages.slice(at)];
}
