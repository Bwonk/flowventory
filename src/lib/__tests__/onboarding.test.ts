// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deriveOnboardingSteps,
  firstIncompleteIndex,
  nextIncompleteIndex,
  type OnboardingSignals,
} from '@/lib/onboarding';

const signals = (overrides: Partial<OnboardingSignals> = {}): OnboardingSignals => ({
  server: { sync: false, tracker: false, threshold: false },
  storeSynced: false,
  trackerInstalled: false,
  thresholdChanged: false,
  thresholdConfirmed: false,
  reportViewed: false,
  complete: false,
  ...overrides,
});

const doneMap = (s: OnboardingSignals) =>
  Object.fromEntries(deriveOnboardingSteps(s).map(step => [step.key, step.done]));

describe('deriveOnboardingSteps', () => {
  it('sinyal yokken hiçbir adım tamam değil', () => {
    expect(doneMap(signals())).toEqual({ sync: false, tracker: false, threshold: false, report: false });
  });

  it('sunucu durumu adımları tamamlar (cihazdan bağımsız)', () => {
    expect(doneMap(signals({ server: { sync: true, tracker: true, threshold: true } }))).toEqual({
      sync: true,
      tracker: true,
      threshold: true,
      report: false,
    });
  });

  it('sunucu yanıtı gelmeden istemci bayrakları iyimser tamamlar', () => {
    const map = doneMap(signals({ server: null, storeSynced: true, trackerInstalled: true, reportViewed: true }));
    expect(map).toEqual({ sync: true, tracker: true, threshold: false, report: true });
  });

  it('varsayılan eşiği onaylamak eşik adımını tamamlar', () => {
    expect(doneMap(signals({ thresholdConfirmed: true })).threshold).toBe(true);
    expect(doneMap(signals({ thresholdChanged: true })).threshold).toBe(true);
  });

  it('mezun kullanıcıda tüm adımlar tamam', () => {
    expect(Object.values(doneMap(signals({ server: null, complete: true })))).toEqual([true, true, true, true]);
  });
});

const s = (...done: boolean[]) => done.map(d => ({ done: d }));

describe('firstIncompleteIndex', () => {
  it('hiçbiri bitmemişse 0 döner', () => {
    expect(firstIncompleteIndex(s(false, false, false))).toBe(0);
  });

  it('aradaki eksik adımı bulur', () => {
    expect(firstIncompleteIndex(s(true, false, true))).toBe(1);
  });

  it('hepsi bittiyse -1 döner', () => {
    expect(firstIncompleteIndex(s(true, true, true))).toBe(-1);
  });
});

describe('nextIncompleteIndex', () => {
  it('tamamlanmış adımların üzerinden atlar', () => {
    expect(nextIncompleteIndex(s(false, true, false), 0)).toBe(2);
  });

  it('geriye sarmaz: sonrasında eksik yoksa -1 döner', () => {
    expect(nextIncompleteIndex(s(false, true, true), 0)).toBe(-1);
  });
});
