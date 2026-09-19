// Aşama ekleme/çıkarma kuralları — React'siz saf fonksiyonlar (vitest ile sınanır).
import { MAX_STAGES, type RuleStage } from '@/lib/rules/types';

/** Aşama 1 kaldırılamaz: sonraki aşamalar "önceki aşamaya" göre ölçer. Geçersiz istekte aynı dizi döner. */
export function removeStageAt(stages: readonly RuleStage[], index: number): readonly RuleStage[] {
  if (index <= 0 || index >= stages.length) return stages;
  return stages.filter((_, i) => i !== index);
}

/**
 * "Geri al": kaldırılan aşamayı eski sırasına koyar. Arada başka aşamalar da
 * kaldırıldıysa sona eklenir; aşama sınırı dolduysa ya da ilk sıraya istenirse
 * aynı dizi döner (çağıran bunu "geri alınamadı" diye bildirir).
 */
export function restoreStageAt(stages: readonly RuleStage[], index: number, stage: RuleStage): readonly RuleStage[] {
  if (index <= 0 || stages.length >= MAX_STAGES) return stages;
  const at = Math.min(index, stages.length);
  return [...stages.slice(0, at), stage, ...stages.slice(at)];
}
