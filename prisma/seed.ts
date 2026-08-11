/**
 * GEÇİCİ SEED — chart / tablo testi için sahte görüntülenme verisi.
 * Son 365 gün (günlük) + bugün (saatlik) için random view üretir.
 * Production'a gitmeden önce silinecek.
 *
 * Çalıştırma:
 *   pnpm db:seed
 *   SEED_MERCHANT_ID=<id> SEED_PRODUCT_IDS=<id1,id2> pnpm db:seed
 *
 * Merchant / ürün ID verilmezse AuthToken + mevcut ProductView kayıtlarından çözülür.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS = 365;

async function resolveMerchantId(): Promise<string> {
  if (process.env.SEED_MERCHANT_ID?.trim()) {
    return process.env.SEED_MERCHANT_ID.trim();
  }

  const token = await prisma.authToken.findFirst({
    where: { deleted: false },
    select: { merchantId: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (token?.merchantId) return token.merchantId;

  throw new Error(
    'Merchant bulunamadı. SEED_MERCHANT_ID verin veya uygulamaya giriş yapıp AuthToken oluşturun.',
  );
}

async function resolveProductIds(merchantId: string): Promise<string[]> {
  if (process.env.SEED_PRODUCT_IDS?.trim()) {
    return process.env.SEED_PRODUCT_IDS.split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const existing = await prisma.productView.groupBy({
    by: ['productId'],
    where: { merchantId },
  });

  if (existing.length > 0) {
    return existing.map((row) => row.productId);
  }

  // Fallback — ikas'taki gerçek ürünlerle eşleşmeyebilir; SEED_PRODUCT_IDS kullanın
  return [
    '6f594145-7602-4c63-8c03-f97f04ff46b2',
    '7463bce1-fae0-4ce3-88cd-903e5af0e59a',
    'd28e2656-a808-48fa-999d-c7f4b9a4c19a',
  ];
}

async function main() {
  const merchantId = await resolveMerchantId();
  const productIds = await resolveProductIds(merchantId);

  console.log(`Seed başlıyor`);
  console.log(`  merchantId: ${merchantId}`);
  console.log(`  products:   ${productIds.length} adet`);
  console.log(`  gün:        son ${DAYS} gün + bugün saatlik`);

  const today = new Date();
  let dailyTotal = 0;

  for (const productId of productIds) {
    for (let i = 0; i < DAYS; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Rastgele 0-60 — bazı günler 0 (gerçekçi dağılım)
      const viewCount = Math.floor(Math.random() * 61);

      await prisma.productView.upsert({
        where: {
          merchantId_productId_date: { merchantId, productId, date: dateStr },
        },
        update: { viewCount },
        create: { merchantId, productId, date: dateStr, viewCount },
      });
      dailyTotal++;
    }
  }

  console.log(`Günlük seed: ${productIds.length} ürün × ${DAYS} gün = ${dailyTotal} kayıt`);

  // Son 7 gün için saatlik veri (son 24 saat grafiği + tarih seçici)
  let hourlyTotal = 0;
  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    for (const productId of productIds) {
      for (let hour = 0; hour < 24; hour++) {
        const viewCount = Math.floor(Math.random() * 15);
        await prisma.productViewHourly.upsert({
          where: {
            merchantId_productId_date_hour: {
              merchantId,
              productId,
              date: dateStr,
              hour,
            },
          },
          update: { viewCount },
          create: { merchantId, productId, date: dateStr, hour, viewCount },
        });
        hourlyTotal++;
      }
    }
  }

  console.log(`Saatlik seed: ${hourlyTotal} kayıt (son 7 gün × 24 saat)`);
  console.log('Seed tamamlandı.');
}

main()
  .catch((e) => {
    console.error('Seed hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
