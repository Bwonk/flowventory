/**
 * Görüntülenme verisi taşıma aracı (bilgisayarlar arası geçiş için).
 *
 * dev.db git'e girmez (AuthToken tablosunda ikas OAuth token'ları var).
 * Bu script yalnızca HASSAS OLMAYAN tabloları JSON'a alır/geri yükler:
 *   - ProductView / ProductViewHourly  (tracker'ın topladığı geçmiş — ikas'tan geri getirilemez)
 *   - MerchantSettings                 (eşikler, TZ, bildirim tercihi)
 * ProductSnapshot/SalesDaily bilerek dahil değil: sync katmanı ilk açılışta
 * ikas'tan yeniden kurar.
 *
 * Kullanım:
 *   pnpm views:export   → prisma/seed-data/views-export.json üretir (commit'lenebilir)
 *   pnpm views:import   → JSON'daki kayıtları upsert eder (var olanları günceller)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXPORT_PATH = join(process.cwd(), 'prisma', 'seed-data', 'views-export.json');

interface ExportFile {
  exportedAt: string;
  productViews: Array<{ merchantId: string; productId: string; date: string; viewCount: number }>;
  productViewsHourly: Array<{ merchantId: string; productId: string; date: string; hour: number; viewCount: number }>;
  merchantSettings: Array<Record<string, unknown> & { merchantId: string }>;
}

async function exportData() {
  const [productViews, productViewsHourly, merchantSettings] = await Promise.all([
    prisma.productView.findMany({
      select: { merchantId: true, productId: true, date: true, viewCount: true },
    }),
    prisma.productViewHourly.findMany({
      select: { merchantId: true, productId: true, date: true, hour: true, viewCount: true },
    }),
    prisma.merchantSettings.findMany({
      select: {
        merchantId: true,
        criticalThreshold: true,
        warningThreshold: true,
        timezone: true,
        currencyCode: true,
        leadTimeDays: true,
        targetStockDays: true,
        notificationEmail: true,
        emailNotifications: true,
      },
    }),
  ]);

  const payload: ExportFile = {
    exportedAt: new Date().toISOString(),
    productViews,
    productViewsHourly,
    merchantSettings,
  };

  mkdirSync(dirname(EXPORT_PATH), { recursive: true });
  writeFileSync(EXPORT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(
    `Export tamam: ${EXPORT_PATH}\n` +
      `  ProductView: ${productViews.length} satır\n` +
      `  ProductViewHourly: ${productViewsHourly.length} satır\n` +
      `  MerchantSettings: ${merchantSettings.length} satır`,
  );
}

async function importData() {
  if (!existsSync(EXPORT_PATH)) {
    console.error(`Bulunamadı: ${EXPORT_PATH} — önce "pnpm views:export" çalıştırın (kaynak makinede).`);
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(EXPORT_PATH, 'utf-8')) as ExportFile;

  for (const row of payload.productViews) {
    await prisma.productView.upsert({
      where: { merchantId_productId_date: { merchantId: row.merchantId, productId: row.productId, date: row.date } },
      update: { viewCount: row.viewCount },
      create: row,
    });
  }
  for (const row of payload.productViewsHourly) {
    await prisma.productViewHourly.upsert({
      where: {
        merchantId_productId_date_hour: {
          merchantId: row.merchantId,
          productId: row.productId,
          date: row.date,
          hour: row.hour,
        },
      },
      update: { viewCount: row.viewCount },
      create: row,
    });
  }
  for (const row of payload.merchantSettings) {
    const { merchantId, ...rest } = row;
    await prisma.merchantSettings.upsert({
      where: { merchantId },
      update: rest,
      create: row as never,
    });
  }

  console.log(
    `Import tamam (${payload.exportedAt} tarihli export):\n` +
      `  ProductView: ${payload.productViews.length} satır\n` +
      `  ProductViewHourly: ${payload.productViewsHourly.length} satır\n` +
      `  MerchantSettings: ${payload.merchantSettings.length} satır`,
  );
}

const mode = process.argv[2];
const run = mode === 'export' ? exportData : mode === 'import' ? importData : null;

if (!run) {
  console.error('Kullanım: tsx prisma/views-transfer.ts <export|import>');
  process.exit(1);
}

run()
  .catch(error => {
    console.error('views-transfer hata:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
