/**
 * Abonelik durumu — saf, test edilebilir (vitest). Kaynaklar: ikas
 * `getMerchantLicence.appSubscriptions` (tek doğruluk kaynağı) + uygulamanın
 * kendi tuttuğu deneme süresi (`AppTrial`).
 */

export type SubscriptionState = 'trial' | 'active' | 'will_be_removed' | 'expired';

export interface LicenceSubscription {
  storeAppListingSubscriptionKey: string;
  status: 'ACTIVE' | 'WILL_BE_REMOVED' | 'REMOVED';
  deleted: boolean;
}

export interface ResolveSubscriptionInput {
  subscriptions: ReadonlyArray<LicenceSubscription>;
  /** Partner panel plan anahtarları (bölge başına bir plan); boş = faturalandırma kapalı. */
  planKeys: ReadonlyArray<string>;
  trialEndsAt: Date | null;
  now: Date;
}

/**
 * Öncelik: planlarımızdan birinde ACTIVE → `active`; WILL_BE_REMOVED →
 * `will_be_removed`; yoksa deneme içindeyse `trial`, değilse `expired`.
 *
 * Faturalandırma kapalıyken (plan anahtarı yok) hiç `expired` dönmez: kimse
 * ödeme yapamazken kilitlemek yolu olmayan bir kilit olurdu.
 */
export function resolveSubscriptionState({
  subscriptions,
  planKeys,
  trialEndsAt,
  now,
}: ResolveSubscriptionInput): SubscriptionState {
  if (planKeys.length > 0) {
    const ours = subscriptions.filter(s => !s.deleted && planKeys.includes(s.storeAppListingSubscriptionKey));
    if (ours.some(s => s.status === 'ACTIVE')) return 'active';
    if (ours.some(s => s.status === 'WILL_BE_REMOVED')) return 'will_be_removed';
  }
  if (trialEndsAt !== null && now.getTime() < trialEndsAt.getTime()) return 'trial';
  return planKeys.length === 0 ? 'trial' : 'expired';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Denemede kalan tam gün (bugün dahil yukarı yuvarlanır); bittiyse 0. */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

/** Uygulamaya erişim var mı? (kilit ekranı kararı) */
export function hasAccess(state: SubscriptionState): boolean {
  return state !== 'expired';
}

export type SubscriptionCurrency = 'TRY' | 'EUR' | 'USD';
export type MerchantRegion = 'AF' | 'AN' | 'AS' | 'EU' | 'OC' | 'PL' | 'TR' | 'US';

export interface AvailableSubscription {
  key: string;
  currencyCode: SubscriptionCurrency;
}

/**
 * Partner panel bölge grupları: TRY › Türkiye, EUR › Avrupa, USD › diğerleri.
 * `PL` Avrupa grubunda sayılır.
 */
export function currencyForRegion(region: MerchantRegion | null): SubscriptionCurrency | null {
  if (region === null) return null;
  if (region === 'TR') return 'TRY';
  if (region === 'EU' || region === 'PL') return 'EUR';
  return 'USD';
}

/**
 * Ödemenin açılacağı plan: ikas'ın mağazaya sunduğu planlardan bizim
 * anahtarlarımızdan biri olanı, mağazanın bölge para birimiyle eşleşeni
 * öncelikli; o yoksa ikas'ın sunduğu ilk planımız. Hiçbiri sunulmuyorsa null.
 */
export function pickSubscription<T extends AvailableSubscription>(
  available: ReadonlyArray<T>,
  planKeys: ReadonlyArray<string>,
  region: MerchantRegion | null,
): T | null {
  const ours = available.filter(s => planKeys.includes(s.key));
  const currency = currencyForRegion(region);
  return ours.find(s => s.currencyCode === currency) ?? ours[0] ?? null;
}
