import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getMerchantAuthToken } from '@/lib/merchant-auth';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { buildPurchaseReport } from '@/lib/reports/purchase-report';
import { dateKeyInTz, shiftDateKey } from '@/lib/timezone';
import { EmailNotConfiguredError } from '@/lib/email/resend';
import { resendErrorKind } from '@/lib/email/resend-error';
import type { AuthToken } from '@/models/auth-token';
import { computeDigest, DEAD_STOCK_WINDOW_DAYS } from './compute';
import { renderDigestEmail, sendDigestEmail } from './email';
import { digestRanges, dueDigestPeriodKey, isDigestFrequency, type ActiveDigestFrequency } from './schedule';

/**
 * Özet raporu orkestrasyonu: veri toplama (sync katmanı + satın alma raporu),
 * vadesi gelen merchant'ları bulma ve DigestLog ile idempotent gönderim.
 */

export class DigestNoDataError extends Error {
  constructor() {
    super('No synced catalog for digest');
    this.name = 'DigestNoDataError';
  }
}

/**
 * Bir merchant'ın özet e-postasını hazırlar. Satın alma raporu önce
 * `ensureFreshSync` çalıştırır — özet taze veriyle gider (ikas erişilemezse
 * eldeki veriyle).
 */
export async function buildDigestEmail(
  merchantId: string,
  authToken: AuthToken,
  frequency: ActiveDigestFrequency,
  now: Date = new Date(),
): Promise<{ subject: string; html: string }> {
  const report = await buildPurchaseReport(merchantId, authToken);
  const settings = await getMerchantSettings(merchantId);
  const { timezone } = settings;

  const ranges = digestRanges(now, frequency, timezone);
  const todayKey = dateKeyInTz(now, timezone);
  const deadStockWindow = { start: shiftDateKey(todayKey, -DEAD_STOCK_WINDOW_DAYS), end: todayKey };
  const salesStart = ranges.previous.start < deadStockWindow.start ? ranges.previous.start : deadStockWindow.start;

  const [snapshots, sales] = await Promise.all([
    prisma.productSnapshot.findMany({
      where: { merchantId },
      select: {
        productId: true,
        productName: true,
        variantId: true,
        totalStock: true,
        sellPrice: true,
        buyPrice: true,
      },
    }),
    prisma.salesDaily.findMany({
      where: { merchantId, date: { gte: salesStart } },
      select: { variantId: true, date: true, quantity: true, revenue: true },
    }),
  ]);
  if (snapshots.length === 0) throw new DigestNoDataError();

  const content = computeDigest({
    frequency,
    ranges,
    deadStockWindow,
    warningThreshold: settings.warningThreshold,
    snapshots,
    sales,
    purchase: {
      lineCount: report.lineCount,
      urgentCount: report.urgentCount,
      totalCost: report.totalCost,
      hasEstimate: report.vendors.some(v => v.hasEstimate),
    },
  });

  return renderDigestEmail(content, settings.currencyCode);
}

export type DigestRunResult = {
  /** Özeti açık ve adresi olan merchant sayısı. */
  enabled: number;
  /** Bu turda vadesi gelen (ve daha önce gönderilmemiş) merchant sayısı. */
  due: number;
  sent: number;
  failed: number;
};

/**
 * Saatlik cron turu. Vadesi gelen her merchant için dönem anahtarını
 * DigestLog'a yazarak "claim" eder; unique ihlali = bu dönem zaten gönderildi
 * (ya da eşzamanlı başka bir tur gönderiyor). Gönderim başarısızsa claim
 * silinir — telafi penceresindeki bir sonraki tur yeniden dener.
 * Merchant'lar sırayla işlenir (SQLite tek yazıcı + ikas rate limit).
 */
export async function runDueDigests(now: Date = new Date()): Promise<DigestRunResult> {
  if (!process.env.RESEND_API_KEY) throw new EmailNotConfiguredError();

  const rows = await prisma.merchantSettings.findMany({
    where: { digestFrequency: { in: ['daily', 'weekly'] }, notificationEmail: { not: null } },
    select: {
      merchantId: true,
      timezone: true,
      notificationEmail: true,
      digestFrequency: true,
      digestWeekday: true,
      digestHour: true,
    },
  });

  const result: DigestRunResult = { enabled: rows.length, due: 0, sent: 0, failed: 0 };

  for (const row of rows) {
    const { merchantId, notificationEmail } = row;
    if (!notificationEmail || !isDigestFrequency(row.digestFrequency) || row.digestFrequency === 'off') continue;
    const frequency = row.digestFrequency;

    const periodKey = dueDigestPeriodKey(
      now,
      { frequency, weekday: row.digestWeekday, hour: row.digestHour },
      row.timezone,
    );
    if (!periodKey) continue;

    try {
      await prisma.digestLog.create({ data: { merchantId, periodKey, status: 'pending' } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
    result.due++;

    try {
      const authToken = await getMerchantAuthToken(merchantId);
      if (!authToken) throw new Error('Auth token not found');

      const email = await buildDigestEmail(merchantId, authToken, frequency, now);
      await sendDigestEmail(notificationEmail, email);
      await prisma.digestLog.update({
        where: { merchantId_periodKey: { merchantId, periodKey } },
        data: { status: 'sent', sentAt: new Date() },
      });
      result.sent++;
      logger.info('Digest sent', { merchantId, periodKey });
    } catch (error) {
      result.failed++;
      logger.error('Digest failed', { merchantId, periodKey, kind: resendErrorKind(error), error });
      await prisma.digestLog
        .delete({ where: { merchantId_periodKey: { merchantId, periodKey } } })
        .catch(() => undefined);
    }
  }

  return result;
}
