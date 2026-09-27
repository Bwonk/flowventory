// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  hasAccess,
  resolveSubscriptionState,
  trialDaysLeft,
  type LicenceSubscription,
} from '@/lib/billing/entitlement';

const KEY = 'flowventory-yearly';
const NOW = new Date('2026-10-01T12:00:00Z');
const IN_TRIAL = new Date('2026-10-05T12:00:00Z');
const TRIAL_OVER = new Date('2026-09-30T12:00:00Z');

const sub = (overrides: Partial<LicenceSubscription> = {}): LicenceSubscription => ({
  storeAppListingSubscriptionKey: KEY,
  status: 'ACTIVE',
  deleted: false,
  ...overrides,
});

describe('resolveSubscriptionState', () => {
  it('planımızda ACTIVE abonelik → active (deneme bitmiş olsa da)', () => {
    expect(
      resolveSubscriptionState({ subscriptions: [sub()], planKey: KEY, trialEndsAt: TRIAL_OVER, now: NOW }),
    ).toBe('active');
  });

  it('WILL_BE_REMOVED → will_be_removed', () => {
    expect(
      resolveSubscriptionState({
        subscriptions: [sub({ status: 'WILL_BE_REMOVED' })],
        planKey: KEY,
        trialEndsAt: TRIAL_OVER,
        now: NOW,
      }),
    ).toBe('will_be_removed');
  });

  it('silinmiş ya da başka plana ait abonelik sayılmaz', () => {
    const subscriptions = [sub({ deleted: true }), sub({ storeAppListingSubscriptionKey: 'baska-plan' })];
    expect(resolveSubscriptionState({ subscriptions, planKey: KEY, trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'expired',
    );
  });

  it('REMOVED abonelik + deneme içi → trial', () => {
    expect(
      resolveSubscriptionState({
        subscriptions: [sub({ status: 'REMOVED' })],
        planKey: KEY,
        trialEndsAt: IN_TRIAL,
        now: NOW,
      }),
    ).toBe('trial');
  });

  it('abonelik yok, deneme bitti → expired', () => {
    expect(resolveSubscriptionState({ subscriptions: [], planKey: KEY, trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'expired',
    );
  });

  it('faturalandırma kapalıyken (plan anahtarı yok) deneme bitse de expired dönmez', () => {
    expect(resolveSubscriptionState({ subscriptions: [], planKey: null, trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'trial',
    );
  });

  it('faturalandırma kapalıyken lisanstaki abonelik yoksayılır', () => {
    expect(
      resolveSubscriptionState({ subscriptions: [sub()], planKey: null, trialEndsAt: IN_TRIAL, now: NOW }),
    ).toBe('trial');
  });
});

describe('trialDaysLeft', () => {
  it('kalan kısmi günü yukarı yuvarlar', () => {
    expect(trialDaysLeft(new Date('2026-10-02T00:00:00Z'), NOW)).toBe(1);
    expect(trialDaysLeft(IN_TRIAL, NOW)).toBe(4);
  });

  it('bittiyse 0', () => {
    expect(trialDaysLeft(TRIAL_OVER, NOW)).toBe(0);
  });
});

describe('hasAccess', () => {
  it('yalnız expired erişimi kapatır', () => {
    expect(hasAccess('trial')).toBe(true);
    expect(hasAccess('active')).toBe(true);
    expect(hasAccess('will_be_removed')).toBe(true);
    expect(hasAccess('expired')).toBe(false);
  });
});
