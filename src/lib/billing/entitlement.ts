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
  /** Partner panel plan anahtarı; null = faturalandırma henüz kapalı. */
  planKey: string | null;
  trialEndsAt: Date | null;
  now: Date;
}

/**
 * Öncelik: planımızda ACTIVE → `active`; WILL_BE_REMOVED → `will_be_removed`;
 * yoksa deneme içindeyse `trial`, değilse `expired`.
 *
 * Faturalandırma kapalıyken (plan anahtarı yok) hiç `expired` dönmez: kimse
 * ödeme yapamazken kilitlemek yolu olmayan bir kilit olurdu.
 */
export function resolveSubscriptionState({
  subscriptions,
  planKey,
  trialEndsAt,
  now,
}: ResolveSubscriptionInput): SubscriptionState {
  if (planKey !== null) {
    const ours = subscriptions.filter(s => !s.deleted && s.storeAppListingSubscriptionKey === planKey);
    if (ours.some(s => s.status === 'ACTIVE')) return 'active';
    if (ours.some(s => s.status === 'WILL_BE_REMOVED')) return 'will_be_removed';
  }
  if (trialEndsAt !== null && now.getTime() < trialEndsAt.getTime()) return 'trial';
  return planKey === null ? 'trial' : 'expired';
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
