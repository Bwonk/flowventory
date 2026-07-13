import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/track/view
 *
 * Storefront'tan gelen ürün görüntülenme event'ini kaydeder.
 * Admin panelinden değil, müşterinin tarayıcısından çağrılır — token yok.
 *
 * Body: { productId: string }
 *
 * Aynı ürün + aynı gün için tek satır tutuyoruz, viewCount'u artırıyoruz.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId gerekli' }, { status: 400 });
    }

    // Bugünün tarihi — "2026-07-16" formatında
    const today = new Date().toISOString().split('T')[0];

    // Upsert: varsa artır, yoksa oluştur
    await prisma.productView.upsert({
      where: {
        productId_date: { productId, date: today },
      },
      update: {
        viewCount: { increment: 1 },
      },
      create: {
        productId,
        date: today,
        viewCount: 1,
      },
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