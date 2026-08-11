import { prisma } from '@/lib/prisma';
import { DEFAULT_MERCHANT_TIMEZONE } from '@/lib/timezone';

/**
 * Sunucu tarafı MerchantSettings okuma yardımcıları.
 * Kayıt yoksa varsayılanlar döner — API route'ları bunları kullanır,
 * böylece TZ gibi değerler tek kaynaktan gelir.
 */

export type ResolvedMerchantSettings = {
  criticalThreshold: number;
  warningThreshold: number;
  timezone: string;
  currencyCode: string;
  leadTimeDays: number;
  targetStockDays: number;
  notificationEmail: string | null;
  emailNotifications: boolean;
};

export const MERCHANT_SETTINGS_DEFAULTS: ResolvedMerchantSettings = {
  criticalThreshold: 5,
  warningThreshold: 10,
  timezone: DEFAULT_MERCHANT_TIMEZONE,
  currencyCode: 'TRY',
  leadTimeDays: 7,
  targetStockDays: 30,
  notificationEmail: null,
  emailNotifications: false,
};

export async function getMerchantSettings(merchantId: string): Promise<ResolvedMerchantSettings> {
  const row = await prisma.merchantSettings.findUnique({ where: { merchantId } });
  if (!row) return MERCHANT_SETTINGS_DEFAULTS;
  return {
    criticalThreshold: row.criticalThreshold,
    warningThreshold: row.warningThreshold,
    timezone: row.timezone,
    currencyCode: row.currencyCode,
    leadTimeDays: row.leadTimeDays,
    targetStockDays: row.targetStockDays,
    notificationEmail: row.notificationEmail,
    emailNotifications: row.emailNotifications,
  };
}

export async function getMerchantTimezone(merchantId: string): Promise<string> {
  return (await getMerchantSettings(merchantId)).timezone;
}
