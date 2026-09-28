import { prisma } from '@/lib/prisma';
import { getIkas } from '@/helpers/api-helpers';
import type { AuthToken } from '@/models/auth-token';
import { PLAN } from './plan';
import {
  pickSubscription,
  resolveSubscriptionState,
  trialDaysLeft,
  type LicenceSubscription,
  type MerchantRegion,
  type SubscriptionCurrency,
  type SubscriptionState,
} from './entitlement';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Partner panelde tanımlı plan anahtarları — bölge başına bir plan,
 * `IKAS_PLAN_KEY`'de virgülle ayrılmış (ör. `trPlan,euPlan,usPlan`). Boşsa
 * faturalandırma kapalı (ödeme başlatılamaz, kilit yok, deneme yine sayar).
 */
export function getPlanKeys(): string[] {
  return (process.env.IKAS_PLAN_KEY ?? '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
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
  /** Mağazanın bölgesindeki planın fiyatı (Partner panel, KDV hariç); alınamazsa null. */
  offer: PlanOffer | null;
}

export interface PlanOffer {
  price: number;
  currency: SubscriptionCurrency;
  period: 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
}

export async function getSubscriptionSummary(
  merchantId: string,
  authToken: AuthToken,
): Promise<SubscriptionSummary> {
  const trial = await ensureTrial(merchantId);
  const planKeys = getPlanKeys();
  const now = new Date();

  let subscriptions: LicenceSubscription[] = [];
  let renewsAt: string | null = null;
  let offer: PlanOffer | null = null;

  if (planKeys.length > 0) {
    const ikas = getIkas(authToken);
    const [licence, available] = await Promise.all([
      ikas.queries.getMerchantLicence(),
      ikas.queries.getAvailableSubscriptions(),
    ]);
    if (!licence.isSuccess || !licence.data?.getMerchantLicence) {
      throw new Error(licence.error ?? 'Lisans bilgisi alınamadı');
    }
    const raw = licence.data.getMerchantLicence.appSubscriptions ?? [];
    subscriptions = raw.map(s => ({
      storeAppListingSubscriptionKey: s.storeAppListingSubscriptionKey,
      status: s.status,
      deleted: s.deleted,
    }));
    const active = raw.find(
      s => !s.deleted && planKeys.includes(s.storeAppListingSubscriptionKey) && s.status !== 'REMOVED',
    );
    if (active?.lastPaymentDate) {
      renewsAt = new Date(active.lastPaymentDate + active.lastPaymentPeriodInDays * DAY_MS).toISOString();
    }
    // Fiyat yalnız gösterim; alınamazsa kart sabit plan bilgisine düşer.
    const plan = available.isSuccess
      ? pickSubscription(available.data?.getAvailableSubscriptions ?? [], planKeys, licence.data.getMerchantLicence.region)
      : null;
    const price = plan?.prices.find(p => p.period === 'YEARLY') ?? plan?.prices[0];
    if (plan && price) offer = { price: price.price, currency: plan.currencyCode, period: price.period };
  }

  return {
    state: resolveSubscriptionState({ subscriptions, planKeys, trialEndsAt: trial.endsAt, now }),
    billingEnabled: planKeys.length > 0,
    trialEndsAt: trial.endsAt.toISOString(),
    trialDaysLeft: trialDaysLeft(trial.endsAt, now),
    renewsAt,
    offer,
  };
}

/**
 * Mağazanın bölgesindeki plan için ikas ödeme kaydı oluşturur; dönen id
 * istemcide `AppBridgeHelper.startMerchantPayment` ile ikas ödeme ekranını açar.
 */
export async function createSubscriptionPayment(authToken: AuthToken): Promise<{ paymentId: string }> {
  const planKeys = getPlanKeys();
  if (planKeys.length === 0) throw new BillingDisabledError();

  const ikas = getIkas(authToken);
  const [licence, available] = await Promise.all([
    ikas.queries.getMerchantLicence(),
    ikas.queries.getAvailableSubscriptions(),
  ]);
  if (!available.isSuccess) {
    throw new Error(available.error ?? 'Planlar alınamadı');
  }
  const region: MerchantRegion | null = licence.data?.getMerchantLicence?.region ?? null;
  const plan = pickSubscription(available.data?.getAvailableSubscriptions ?? [], planKeys, region);
  if (!plan) throw new Error('Mağazanın bölgesi için tanımlı plan bulunamadı');

  const res = await ikas.mutations.createMerchantAppPayment({
    input: { storeAppListingSubscriptionKey: plan.key },
  });
  const payment = res.data?.createMerchantAppPayment;
  if (!res.isSuccess || !payment) {
    throw new Error(res.error ?? 'Ödeme oluşturulamadı');
  }
  return { paymentId: payment.id };
}
