import { prisma } from '@/lib/prisma';
import { getIkas } from '@/helpers/api-helpers';
import type { AuthToken } from '@/models/auth-token';
import { PLAN } from './plan';
import {
  resolveSubscriptionState,
  trialDaysLeft,
  type LicenceSubscription,
  type SubscriptionState,
} from './entitlement';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Partner panelde tanımlı planın anahtarı. Plan gerçek deploy'da
 * oluşturulur; o zamana dek boş → faturalandırma kapalı (ödeme başlatılamaz,
 * kilit yok, deneme yine sayar).
 */
export function getPlanKey(): string | null {
  const key = process.env.IKAS_PLAN_KEY?.trim();
  return key ? key : null;
}

export class BillingDisabledError extends Error {
  constructor() {
    super('Faturalandırma henüz açık değil');
    this.name = 'BillingDisabledError';
  }
}

/**
 * Mağazanın deneme kaydı; yoksa şimdi başlatır. Kayıt bir kez oluşur ve
 * güncellenmez (uninstall purge'üne dahil değil — kaldır-kur sıfırlamaz).
 */
export async function ensureTrial(merchantId: string): Promise<{ startedAt: Date; endsAt: Date }> {
  const now = new Date();
  return prisma.appTrial.upsert({
    where: { merchantId },
    create: { merchantId, startedAt: now, endsAt: new Date(now.getTime() + PLAN.trialDays * DAY_MS) },
    update: {},
    select: { startedAt: true, endsAt: true },
  });
}

export interface SubscriptionSummary {
  state: SubscriptionState;
  /** Partner panel planı tanımlı mı (ödeme başlatılabilir mi)? */
  billingEnabled: boolean;
  trialEndsAt: string;
  /** Denemede kalan gün; deneme dışı durumlarda 0 olabilir. */
  trialDaysLeft: number;
  /** Aktif aboneliğin bir sonraki yenilemesi (son ödeme + dönem); bilinmiyorsa null. */
  renewsAt: string | null;
}

export async function getSubscriptionSummary(
  merchantId: string,
  authToken: AuthToken,
): Promise<SubscriptionSummary> {
  const trial = await ensureTrial(merchantId);
  const planKey = getPlanKey();
  const now = new Date();

  let subscriptions: LicenceSubscription[] = [];
  let renewsAt: string | null = null;

  if (planKey !== null) {
    const res = await getIkas(authToken).queries.getMerchantLicence();
    if (!res.isSuccess || !res.data?.getMerchantLicence) {
      throw new Error(res.error ?? 'Lisans bilgisi alınamadı');
    }
    const raw = res.data.getMerchantLicence.appSubscriptions ?? [];
    subscriptions = raw.map(s => ({
      storeAppListingSubscriptionKey: s.storeAppListingSubscriptionKey,
      status: s.status,
      deleted: s.deleted,
    }));
    const active = raw.find(
      s => !s.deleted && s.storeAppListingSubscriptionKey === planKey && s.status !== 'REMOVED',
    );
    if (active?.lastPaymentDate) {
      renewsAt = new Date(active.lastPaymentDate + active.lastPaymentPeriodInDays * DAY_MS).toISOString();
    }
  }

  return {
    state: resolveSubscriptionState({ subscriptions, planKey, trialEndsAt: trial.endsAt, now }),
    billingEnabled: planKey !== null,
    trialEndsAt: trial.endsAt.toISOString(),
    trialDaysLeft: trialDaysLeft(trial.endsAt, now),
    renewsAt,
  };
}

/**
 * Plan için ikas ödeme kaydı oluşturur; dönen id istemcide
 * `AppBridgeHelper.startMerchantPayment` ile ikas ödeme ekranını açar.
 */
export async function createSubscriptionPayment(authToken: AuthToken): Promise<{ paymentId: string }> {
  const planKey = getPlanKey();
  if (planKey === null) throw new BillingDisabledError();

  const res = await getIkas(authToken).mutations.createMerchantAppPayment({
    input: { storeAppListingSubscriptionKey: planKey },
  });
  const payment = res.data?.createMerchantAppPayment;
  if (!res.isSuccess || !payment) {
    throw new Error(res.error ?? 'Ödeme oluşturulamadı');
  }
  return { paymentId: payment.id };
}
