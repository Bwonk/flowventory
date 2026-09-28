import { getIkas } from '@/helpers/api-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { buildPurchaseOrderDocument, type PurchaseOrderDocument } from '@/lib/documents/purchase-order';
import { EMPTY_PROFILE, profileFromMerchant, type MerchantProfile } from '@/lib/documents/profile';
import type { AuthToken } from '@/models/auth-token';
import type { PurchaseOrderItem } from './types';

/**
 * Sipariş belgesinin sunucu tarafı veri toplama: ikas mağaza bilgisi
 * (unvan/VKN/adres), tedarikçi iletişimi ve mağaza ayarları → saf
 * `buildPurchaseOrderDocument`.
 */

/** ikas mağaza bilgisi; hata belgeyi durdurmaz — boş kutular basılmaz. */
export async function fetchMerchantProfile(authToken: AuthToken): Promise<MerchantProfile> {
  try {
    const res = await getIkas(authToken).queries.getMerchantProfile();
    return profileFromMerchant(res.data?.getMerchant);
  } catch (error) {
    logger.warn('Merchant profile lookup failed', { error });
    return EMPTY_PROFILE;
  }
}

export async function buildOrderDocument(
  merchantId: string,
  order: PurchaseOrderItem,
  profile: MerchantProfile,
): Promise<PurchaseOrderDocument> {
  const [settings, contact] = await Promise.all([
    getMerchantSettings(merchantId),
    prisma.vendorContact.findUnique({ where: { merchantId_vendorId: { merchantId, vendorId: order.vendorId } } }),
  ]);
  return buildPurchaseOrderDocument(order, {
    store: profile,
    storeEmail: settings.notificationEmail ?? null,
    vendor: { email: contact?.email ?? null, phone: contact?.phone ?? null, casePack: contact?.casePack ?? null },
    timeZone: settings.timezone,
    currencyCode: settings.currencyCode,
  });
}
