import { logger } from '@/lib/logger';
import { getMerchantTimezone } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { dateKeyInTz, hourInTz } from '@/lib/timezone';
import { verifyTrackToken } from '@/lib/track-token';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/track/view
 *
 * Storefront'tan gelen ürün görüntülenme event'ini kaydeder.
 * Admin panelinden değil, müşterinin tarayıcısından çağrılır — JWT yok.
 *
 * Güvenlik katmanları:
 * - `token`: kurulumda tracker'a gömülen, CLIENT_SECRET ile imzalı
 *   merchant token'ı. Başka mağaza adına yazma (cross-tenant) engellenir.
 * - Rate limit: IP başına dakikada 60 istek.
 * - zod ile body validasyonu.
 *
 * Aynı merchant + ürün + gün için tek satır tutuyoruz, viewCount'u artırıyoruz.
 */

const trackViewSchema = z.object({
  productId: z.string().min(1).max(100),
  merchantId: z.string().min(1).max(100),
  token: z.string().min(1).max(200),
});

const RATE_LIMIT_PER_MINUTE = 60;

function jsonWithCors(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit — IP bazlı (proxy arkasında x-forwarded-for ilk değer).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`track:${ip}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
      return jsonWithCors({ error: 'Too many requests' }, 429);
    }

    const parsed = trackViewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonWithCors({ error: 'Geçersiz istek gövdesi' }, 400);
    }
    const { productId, merchantId, token } = parsed.data;

    // İmza doğrulaması — token yalnızca kurulum sırasında bizim ürettiğimiz
    // değerse geçerli. Eski (token'sız) script kurulumları reddedilir;
    // Ayarlar sayfasından script'in yeniden kurulması gerekir.
    if (!verifyTrackToken(merchantId, token)) {
      return jsonWithCors({ error: 'Geçersiz token' }, 401);
    }

    // Bugünün tarihi + saati — merchant'ın kendi timezone'unda
    const timezone = await getMerchantTimezone(merchantId);
    const now = new Date();
    const today = dateKeyInTz(now, timezone);
    const hour = hourInTz(now, timezone);

    // Upsert: varsa artır, yoksa oluştur
    await prisma.productView.upsert({
      where: {
        merchantId_productId_date: { merchantId, productId, date: today },
      },
      update: {
        viewCount: { increment: 1 },
      },
      create: {
        merchantId,
        productId,
        date: today,
        viewCount: 1,
      },
    });

    // Saatlik kırılım
    await prisma.productViewHourly.upsert({
      where: { merchantId_productId_date_hour: { merchantId, productId, date: today, hour } },
      update: { viewCount: { increment: 1 } },
      create: { merchantId, productId, date: today, hour, viewCount: 1 },
    });

    return jsonWithCors({ ok: true });
  } catch (error) {
    logger.error('Track view error:', { error });
    return jsonWithCors({ error: 'Kaydedilemedi' }, 500);
  }
}

/**
 * OPTIONS — CORS preflight
 * Storefront farklı domain'den istek atacağı için gerekli.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
