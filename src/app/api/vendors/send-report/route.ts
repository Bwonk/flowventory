import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { buildPurchaseReport } from '@/lib/reports/purchase-report';
import { EmailNotConfiguredError, sendVendorOrderEmail } from '@/lib/vendors/purchase-email';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const lineSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().min(1).max(100_000),
});

const sendSchema = z.object({
  vendorId: z.string().min(1),
  /** Sepet satırları; verilmezse eski davranış (tüm öneri satırları). */
  lines: z.array(lineSchema).min(1).max(500).optional(),
});

export type SendVendorReportApiResponse = {
  sentTo: string;
  lineCount: number;
  totalCost: number;
};

/**
 * POST /api/vendors/send-report
 *
 * Tedarikçinin sipariş satırlarını e-posta ile gönderir. `lines` (sepet)
 * verilirse adetler istemciden, satır verisi sunucu raporundan gelir;
 * verilmezse güncel öneri satırları önerilen adetle gönderilir
 * (buildPurchaseReport) — istemcide görünen sayılar önizlemedir.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const parsed = sendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }
    const { vendorId, lines } = parsed.data;

    const contact = await prisma.vendorContact.findUnique({
      where: { merchantId_vendorId: { merchantId: user.merchantId, vendorId } },
    });
    if (!contact?.email) {
      return NextResponse.json({ error: 'Tedarikçi e-posta adresi kayıtlı değil.' }, { status: 422 });
    }

    const report = await buildPurchaseReport(user.merchantId, authToken);
    const vendor = report.vendors.find(v => v.vendorId === vendorId);
    if (!vendor) {
      return NextResponse.json({ error: 'Bu tedarikçi için sipariş önerisi yok.' }, { status: 422 });
    }

    // Sepet verilmişse adetler istemciden gelir (öneri olmayan satırlar dahil);
    // fiyat/isim gibi her şey yine sunucu raporundan okunur, yabancı variantId düşer.
    // Sepetsiz istek eski davranışı korur: tüm öneri satırları önerilen adetle.
    const orderLines = lines
      ? lines.flatMap(({ variantId, qty }) => {
          const line = vendor.lines.find(l => l.variantId === variantId);
          return line ? [{ ...line, suggestedQty: qty, lineTotal: Math.round(qty * line.unitCost) }] : [];
        })
      : vendor.lines.filter(l => l.needsOrder);
    if (orderLines.length === 0) {
      return NextResponse.json(
        { error: lines ? 'Sipariş listesi boş.' : 'Bu tedarikçi için sipariş önerisi yok.' },
        { status: 422 },
      );
    }

    const totalCost = orderLines.reduce((sum, l) => sum + l.lineTotal, 0);
    const hasEstimate = orderLines.some(l => l.isEstimate);

    const { currencyCode } = await getMerchantSettings(user.merchantId);
    await sendVendorOrderEmail(
      contact.email,
      { ...vendor, lines: orderLines, totalCost, hasEstimate },
      currencyCode,
    );

    const data: SendVendorReportApiResponse = {
      sentTo: contact.email,
      lineCount: orderLines.length,
      totalCost,
    };
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: 'E-posta servisi yapılandırılmamış.' }, { status: 503 });
    }
    logger.error('Send vendor report error', { error });
    return NextResponse.json({ error: 'Gönderilemedi' }, { status: 500 });
  }
}
