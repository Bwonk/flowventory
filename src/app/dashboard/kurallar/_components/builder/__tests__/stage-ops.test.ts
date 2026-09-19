import { describe, expect, it } from 'vitest';
import { MAX_STAGES, type RuleStage } from '@/lib/rules/types';
import { removeStageAt, restoreStageAt } from '../stage-ops';

const stage = (threshold: number): RuleStage => ({
  conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold } }],
  actions: [{ type: 'notify' }],
});
const thresholds = (stages: readonly RuleStage[]) =>
  stages.map(s => ('threshold' in s.conditions[0].condition ? s.conditions[0].condition.threshold : null));

describe('removeStageAt', () => {
  const stages = [stage(1), stage(2), stage(3)];

  it('aradaki aşamayı kaldırır', () => {
    expect(thresholds(removeStageAt(stages, 1))).toEqual([1, 3]);
  });

  it('aşama 1 ve aralık dışı istek diziyi değiştirmez', () => {
    expect(removeStageAt(stages, 0)).toBe(stages);
    expect(removeStageAt(stages, 3)).toBe(stages);
    expect(removeStageAt(stages, -1)).toBe(stages);
  });
});

describe('restoreStageAt', () => {
  it('kaldırılan aşamayı eski sırasına koyar', () => {
    const stages = [stage(1), stage(2), stage(3)];
    const removed = stages[1];
    const restored = restoreStageAt(removeStageAt(stages, 1), 1, removed);
    expect(thresholds(restored)).toEqual([1, 2, 3]);
  });

  it('arada dizi kısaldıysa sona ekler', () => {
    expect(thresholds(restoreStageAt([stage(1)], 2, stage(3)))).toEqual([1, 3]);
  });

  it('ilk sıraya koymaz', () => {
    const stages = [stage(1)];
    expect(restoreStageAt(stages, 0, stage(9))).toBe(stages);
  });

  it('aşama sınırı doluysa geri almaz', () => {
    const full = Array.from({ length: MAX_STAGES }, (_, i) => stage(i + 1));
    expect(restoreStageAt(full, 1, stage(9))).toBe(full);
  });
});
