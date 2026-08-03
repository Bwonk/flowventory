import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/track/view
 *
 * Storefront'tan gelen ürün görüntülenme event'ini kaydeder.
 * Admin panelinden değil, müşterinin tarayıcısından çağrılır — token yok.
 *
 * Body: { productId: string, merchantId: string }
 *
 * Aynı merchant + ürün + gün için tek satır tutuyoruz, viewCount'u artırıyoruz.
 * merchantId, kurulum sırasında tracker script'ine gömülür ve multi-tenant
 * izolasyonu sağlar (her mağazanın verisi ayrı).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, merchantId } = body;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId gerekli' }, { status: 400 });
    }

    if (!merchantId || typeof merchantId !== 'string') {
      return NextResponse.json({ error: 'merchantId gerekli' }, { status: 400 });
    }

    // Bugünün tarihi — "2026-07-16" formatında
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

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

    // YENİ: saatlik upsert
    await prisma.productViewHourly.upsert({
      where: { merchantId_productId_date_hour: { merchantId, productId, date: today, hour } },
      update: { viewCount: { increment: 1 } },
      create: { merchantId, productId, date: today, hour, viewCount: 1 },
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Track view error:', error);
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
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