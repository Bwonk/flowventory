// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  currencyForRegion,
  hasAccess,
  pickSubscription,
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
      resolveSubscriptionState({ subscriptions: [sub()], planKeys: [KEY], trialEndsAt: TRIAL_OVER, now: NOW }),
    ).toBe('active');
  });

  it('WILL_BE_REMOVED → will_be_removed', () => {
    expect(
      resolveSubscriptionState({
        subscriptions: [sub({ status: 'WILL_BE_REMOVED' })],
        planKeys: [KEY],
        trialEndsAt: TRIAL_OVER,
        now: NOW,
      }),
    ).toBe('will_be_removed');
  });

  it('silinmiş ya da başka plana ait abonelik sayılmaz', () => {
    const subscriptions = [sub({ deleted: true }), sub({ storeAppListingSubscriptionKey: 'baska-plan' })];
    expect(resolveSubscriptionState({ subscriptions, planKeys: [KEY], trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'expired',
    );
  });

  it('REMOVED abonelik + deneme içi → trial', () => {
    expect(
      resolveSubscriptionState({
        subscriptions: [sub({ status: 'REMOVED' })],
        planKeys: [KEY],
        trialEndsAt: IN_TRIAL,
        now: NOW,
      }),
    ).toBe('trial');
  });

  it('abonelik yok, deneme bitti → expired', () => {
    expect(resolveSubscriptionState({ subscriptions: [], planKeys: [KEY], trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'expired',
    );
  });

  it('faturalandırma kapalıyken (plan anahtarı yok) deneme bitse de expired dönmez', () => {
    expect(resolveSubscriptionState({ subscriptions: [], planKeys: [], trialEndsAt: TRIAL_OVER, now: NOW })).toBe(
      'trial',
    );
  });

  it('bölge planlarından herhangi biri aktifse active', () => {
    expect(
      resolveSubscriptionState({
        subscriptions: [sub({ storeAppListingSubscriptionKey: 'eur-plan' })],
        planKeys: [KEY, 'eur-plan'],
        trialEndsAt: TRIAL_OVER,
        now: NOW,
      }),
    ).toBe('active');
  });

  it('faturalandırma kapalıyken lisanstaki abonelik yoksayılır', () => {
    expect(
      resolveSubscriptionState({ subscriptions: [sub()], planKeys: [], trialEndsAt: IN_TRIAL, now: NOW }),
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

describe('currencyForRegion', () => {
  it('Partner panel bölge gruplarını izler', () => {
    expect(currencyForRegion('TR')).toBe('TRY');
    expect(currencyForRegion('EU')).toBe('EUR');
    expect(currencyForRegion('PL')).toBe('EUR');
    expect(currencyForRegion('US')).toBe('USD');
    expect(currencyForRegion('AS')).toBe('USD');
    expect(currencyForRegion(null)).toBeNull();
  });
});

describe('pickSubscription', () => {
  const available = [
    { key: 'try-plan', currencyCode: 'TRY' as const },
    { key: 'eur-plan', currencyCode: 'EUR' as const },
    { key: 'usd-plan', currencyCode: 'USD' as const },
  ];
  const keys = ['try-plan', 'eur-plan', 'usd-plan'];

  it('mağazanın bölge para birimindeki planı seçer', () => {
    expect(pickSubscription(available, keys, 'TR')?.key).toBe('try-plan');
    expect(pickSubscription(available, keys, 'EU')?.key).toBe('eur-plan');
    expect(pickSubscription(available, keys, 'OC')?.key).toBe('usd-plan');
  });

  it('bölge eşleşmesi yoksa sunulan ilk planımıza düşer', () => {
    expect(pickSubscription([available[1]], keys, 'TR')?.key).toBe('eur-plan');
  });

  it('bizim olmayan planları yoksayar; hiçbiri yoksa null', () => {
    expect(pickSubscription([{ key: 'baska', currencyCode: 'TRY' as const }], keys, 'TR')).toBeNull();
  });
});
