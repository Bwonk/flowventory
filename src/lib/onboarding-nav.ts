import type { SubscriptionState } from '@/lib/billing/entitlement';

export interface OnboardingNavInput {
  doneCount: number;
  total: number;
  /** Tüm kurulum adımları tamam. */
  complete: boolean;
  /** Rehber gizlendi. */
  dismissed: boolean;
  /** null = henüz bilinmiyor ya da alınamadı. */
  subscription: SubscriptionState | null;
}

export interface OnboardingNavState {
  visible: boolean;
  /** Nav satırının sağındaki kısa rozet ("2/4", "Deneme"…). */
  badge: string | null;
}

const SUBSCRIPTION_BADGE: Record<Exclude<SubscriptionState, 'active'>, string> = {
  trial: 'Deneme',
  will_be_removed: 'Bitiyor',
  expired: 'Bitti',
};

/**
 * Sidebar'daki "Başlarken" satırı: kurulum sürerken ilerleme rozetiyle; kurulum
 * bitti/gizlendi ama abonelik aktif değilse abonelik rozetiyle (plan yolu
 * görünür kalsın); ikisi de tamamsa satır emekli. Abonelik bilinmezken yalnız
 * kurulum kuralı uygulanır — bilinmeyen durumda satır titreyip kaybolmasın.
 */
export function getOnboardingNavState(input: OnboardingNavInput): OnboardingNavState {
  const setupPending = !input.complete && !input.dismissed;
  if (setupPending) {
    return { visible: true, badge: `${input.doneCount}/${input.total}` };
  }
  if (input.subscription !== null && input.subscription !== 'active') {
    return { visible: true, badge: SUBSCRIPTION_BADGE[input.subscription] };
  }
  return { visible: false, badge: null };
}
