// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveOnboardingSteps, type OnboardingSignals } from '@/lib/onboarding';
import { getOnboardingNavState, type OnboardingNavInput } from '@/lib/onboarding-nav';

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

describe('getOnboardingNavState', () => {
  const nav = (overrides: Partial<OnboardingNavInput> = {}) =>
    getOnboardingNavState({
      doneCount: 2,
      total: 4,
      complete: false,
      dismissed: false,
      subscription: null,
      ...overrides,
    });

  it('kurulum sürerken ilerleme rozeti', () => {
    expect(nav()).toEqual({ visible: true, badge: '2/4' });
    expect(nav({ subscription: 'active' })).toEqual({ visible: true, badge: '2/4' });
  });

  it('kurulum bitti, abonelik denemede → Deneme', () => {
    expect(nav({ complete: true, subscription: 'trial' })).toEqual({ visible: true, badge: 'Deneme' });
  });

  it('rehber gizlendi ama deneme bitti → Bitti', () => {
    expect(nav({ dismissed: true, subscription: 'expired' })).toEqual({ visible: true, badge: 'Bitti' });
  });

  it('kurulum bitti ve abonelik aktif → satır emekli', () => {
    expect(nav({ complete: true, subscription: 'active' })).toEqual({ visible: false, badge: null });
  });

  it('abonelik bilinmezken kurulum bitmişse satır görünmez', () => {
    expect(nav({ complete: true, subscription: null })).toEqual({ visible: false, badge: null });
  });
});
