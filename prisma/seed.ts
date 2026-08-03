/**
 * GEÇİCİ SEED — chart testi için sahte görüntülenme verisi.
 * Son 365 gün için random view üretir.
 * Production'a gitmeden önce silinecek.
 *
 * Çalıştırma: pnpm prisma db seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed verisi tek bir merchant'a scope'lanır. Dashboard giriş yapan
// merchant'ın merchantId'sine göre filtrelediği için, verinin görünmesi
// isteniyorsa SEED_MERCHANT_ID env ile kendi merchantId'nizi verin.
const MERCHANT_ID = process.env.SEED_MERCHANT_ID ?? 'seed-merchant';

const PRODUCT_IDS = [
  '6f594145-7602-4c63-8c03-f97f04ff46b2',
  '7463bce1-fae0-4ce3-88cd-903e5af0e59a',
  'd28e2656-a808-48fa-999d-c7f4b9a4c19a',
];

const DAYS = 365; // son 1 yıl

async function main() {
  console.log(`Seed başlıyor — son ${DAYS} gün için sahte görüntülenme verisi...`);

  const today = new Date();
  let total = 0;

  for (const productId of PRODUCT_IDS) {
    for (let i = 0; i < DAYS; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Rastgele 0-60 arası — bazı günler 0 olsun (gerçekçi)
      const viewCount = Math.floor(Math.random() * 61);

      await prisma.productView.upsert({
        where: {
          merchantId_productId_date: { merchantId: MERCHANT_ID, productId, date: dateStr },
        },
        update: { viewCount },
        create: { merchantId: MERCHANT_ID, productId, date: dateStr, viewCount },
      });
      total++;
    }
  }

  console.log(`Seed tamamlandı. ${PRODUCT_IDS.length} ürün × ${DAYS} gün = ${total} kayıt.`);

  const todayStr = new Date().toISOString().split('T')[0];
  for (const productId of PRODUCT_IDS) {
    for (let hour = 0; hour < 24; hour++) {
      const viewCount = Math.floor(Math.random() * 15); // 0-14 arası
      await prisma.productViewHourly.upsert({
        where: {
          merchantId_productId_date_hour: {
            merchantId: MERCHANT_ID,
            productId,
            date: todayStr,
            hour,
          },
        },
        update: { viewCount },
        create: { merchantId: MERCHANT_ID, productId, date: todayStr, hour, viewCount },
      });
    }
  }

  console.log('Saatlik seed de eklendi.');
}

main()
  .catch((e) => {
    console.error('Seed hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });