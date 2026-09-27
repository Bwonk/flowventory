/** Onboarding bileşeninin saf adım mantığı (vitest; .tsx'ten ayrı). */

export interface OnboardingStepState {
  key: string;
  done: boolean;
}

/**
 * Açık adım tamamlandığında açılacak sıradaki adım: önce ondan SONRAKİ ilk
 * eksik adım, yoksa baştan ilk eksik adım; hiç eksik yoksa null.
 */
export function nextOpenKey(
  steps: ReadonlyArray<OnboardingStepState>,
  fromKey: string,
): string | null {
  const from = steps.findIndex(s => s.key === fromKey);
  const after = steps.slice(from + 1).find(s => !s.done);
  if (after) return after.key;
  return steps.find(s => !s.done)?.key ?? null;
}
