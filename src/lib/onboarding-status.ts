import { prisma } from '@/lib/prisma';

/**
 * Başlarken adımlarının SUNUCU tarafında bilinen tamamlanma durumu —
 * cihazdan bağımsız kaynak (`useOnboardingSteps` istemci bayraklarıyla
 * birleştirir). Rapor ziyareti ve "varsayılan eşiği kullan" onayı istemcide
 * kalır (bkz. src/lib/onboarding.ts).
 */
export interface OnboardingStatus {
  /** En az bir tam senkron başarıyla bitti (OAuth kurulumu arka planda çalıştırır). */
  sync: boolean;
  /** Takip scripti vitrine kurulu. */
  tracker: boolean;
  /** Stok eşikleri varsayılandan farklı kaydedilmiş. */
  threshold: boolean;
}

// MerchantSettings @default değerleriyle aynı (prisma/schema.prisma).
const DEFAULT_CRITICAL_THRESHOLD = 5;
const DEFAULT_WARNING_THRESHOLD = 10;

export async function getOnboardingStatus(merchantId: string): Promise<OnboardingStatus> {
  const [syncLog, trackerInstall, settings] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { merchantId, type: 'full', status: 'success' },
      select: { id: true },
    }),
    prisma.trackingScriptInstall.findUnique({ where: { merchantId }, select: { id: true } }),
    prisma.merchantSettings.findUnique({
      where: { merchantId },
      select: { criticalThreshold: true, warningThreshold: true },
    }),
  ]);

  return {
    sync: syncLog !== null,
    tracker: trackerInstall !== null,
    threshold:
      settings !== null &&
      (settings.criticalThreshold !== DEFAULT_CRITICAL_THRESHOLD ||
        settings.warningThreshold !== DEFAULT_WARNING_THRESHOLD),
  };
}
