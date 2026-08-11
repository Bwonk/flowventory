import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { invalidateSync, refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { validateIkasWebhookSignature, type IkasWebhook } from '@ikas/admin-api-client';
import { NextRequest, NextResponse } from 'next/server';

/** App client secret used to verify the HMAC-SHA256 webhook signature. */
const CLIENT_SECRET = process.env.CLIENT_SECRET;

/** Stok/ürün payload'larından productId çıkarımı için gevşek tip. */
type ProductishWebhookData = {
  id?: string;
  productId?: string;
};

/**
 * POST /api/ikas/webhook
 *
 * ikas webhook event'lerini işler. Akış:
 * 1. İmza doğrulaması (HMAC-SHA256, CLIENT_SECRET).
 * 2. Idempotency: event id WebhookEvent tablosuna yazılır; daha önce
 *    işlendiyse (ikas retry) hiçbir şey yapılmadan 200 dönülür.
 * 3. Scope'a göre yerel sync katmanı güncellenir:
 *    - store/stock/*, store/product/created|updated → ilgili ürünün
 *      snapshot'ı ikas'tan tazelenir (tek ürünlük sorgu).
 *    - store/product/deleted → snapshot satırları silinir.
 *    - store/order/*  → sipariş verisi "kirli" işaretlenir; bir sonraki
 *      analytics okuması yeniden sync yapar (çift sayma riski yok).
 *    - store/app/deleted → merchant'ın tüm verisi silinir (KVKK/GDPR).
 *
 * Not (eski davranış): stok webhook'u gelen değeri saveVariantStocks ile
 * ikas'a GERİ yazıyordu — bu bir no-op'tu ve kaldırıldı. ikas stok verisinin
 * kaynağıdır; biz yalnızca yerel kopyamızı güncelleriz.
 */
export async function POST(request: NextRequest) {
  try {
    if (!CLIENT_SECRET) {
      // Misconfigured deployment; never proceed without a secret to verify against.
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const rawBody = await request.text();
    let webhook: IkasWebhook;
    try {
      webhook = JSON.parse(rawBody) as IkasWebhook;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!validateIkasWebhookSignature(webhook, CLIENT_SECRET)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Idempotency — aynı event id ikinci kez gelirse işlem yapma.
    if (webhook.id) {
      try {
        await prisma.webhookEvent.create({
          data: { id: webhook.id, merchantId: webhook.merchantId, scope: webhook.scope },
        });
      } catch {
        // Unique ihlali = daha önce işlendi (ikas retry). Başarı dön ki retry dursun.
        return NextResponse.json({ success: true, deduped: true });
      }
    }

    switch (webhook.scope) {
      case 'store/stock/created':
      case 'store/stock/updated':
      case 'store/product/created':
      case 'store/product/updated': {
        const authToken = await AuthTokenManager.get(webhook.authorizedAppId);
        if (!authToken) {
          return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
        }
        let payload: ProductishWebhookData;
        try {
          payload = JSON.parse(webhook.data) as ProductishWebhookData;
        } catch {
          return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
        }
        // Ürün event'inde id, stok event'inde productId gelir.
        const productId =
          webhook.scope.startsWith('store/product/') ? payload.id : payload.productId;
        if (!productId) {
          return NextResponse.json({ success: true, message: 'No product id in payload' });
        }
        await refreshProductSnapshot(webhook.merchantId, authToken, productId);
        return NextResponse.json({ success: true });
      }

      case 'store/product/deleted': {
        let payload: ProductishWebhookData;
        try {
          payload = JSON.parse(webhook.data) as ProductishWebhookData;
        } catch {
          return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
        }
        if (payload.id) {
          await prisma.productSnapshot.deleteMany({
            where: { merchantId: webhook.merchantId, productId: payload.id },
          });
        }
        return NextResponse.json({ success: true });
      }

      case 'store/order/created':
      case 'store/order/updated': {
        await invalidateSync(webhook.merchantId);
        return NextResponse.json({ success: true });
      }

      case 'store/app/deleted': {
        // Uygulama kaldırıldı — merchant'a ait TÜM veriyi temizle.
        const { merchantId } = webhook;
        await prisma.$transaction([
          prisma.productSnapshot.deleteMany({ where: { merchantId } }),
          prisma.salesDaily.deleteMany({ where: { merchantId } }),
          prisma.syncLog.deleteMany({ where: { merchantId } }),
          prisma.productView.deleteMany({ where: { merchantId } }),
          prisma.productViewHourly.deleteMany({ where: { merchantId } }),
          prisma.trackingScriptInstall.deleteMany({ where: { merchantId } }),
          prisma.merchantSettings.deleteMany({ where: { merchantId } }),
          prisma.webhookEvent.deleteMany({ where: { merchantId } }),
          prisma.authToken.deleteMany({ where: { merchantId } }),
        ]);
        logger.info('App uninstalled, merchant data purged:', { merchantId });
        return NextResponse.json({ success: true });
      }

      default:
        // Bilinmeyen/ilgilenilmeyen scope — retry olmasın diye 200.
        return NextResponse.json({ success: true, skipped: webhook.scope });
    }
  } catch (error) {
    logger.error('Error processing ikas webhook:', { error });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
