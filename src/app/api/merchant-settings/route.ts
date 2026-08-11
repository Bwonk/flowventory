import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { DEFAULT_MERCHANT_TIMEZONE } from '@/lib/timezone';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Merchant ayarları — tek kaynak.
 *
 * GET  /api/merchant-settings  → kayıt yoksa varsayılanları döner (kayıt açmaz)
 * PUT  /api/merchant-settings  → kısmi güncelleme, upsert
 *
 * Stok eşiği daha önce localStorage'daydı (cihaza bağlı, kullanıcılar arası
 * tutarsız, sunucu habersiz). Artık burada yaşıyor; client localStorage'ı
 * yalnızca hızlı ilk boyama için cache olarak kullanıyor.
 */

export type MerchantSettingsApiResponse = {
  criticalThreshold: number;
  warningThreshold: number;
  timezone: string;
  currencyCode: string;
  leadTimeDays: number;
  targetStockDays: number;
  notificationEmail: string | null;
  emailNotifications: boolean;
};

const DEFAULTS: MerchantSettingsApiResponse = {
  criticalThreshold: 5,
  warningThreshold: 10,
  timezone: DEFAULT_MERCHANT_TIMEZONE,
  currencyCode: 'TRY',
  leadTimeDays: 7,
  targetStockDays: 30,
  notificationEmail: null,
  emailNotifications: false,
};

const updateSchema = z
  .object({
    criticalThreshold: z.number().int().min(0).max(100000).optional(),
    warningThreshold: z.number().int().min(0).max(100000).optional(),
    timezone: z.string().min(1).max(64).optional(),
    currencyCode: z.string().length(3).optional(),
    leadTimeDays: z.number().int().min(0).max(365).optional(),
    targetStockDays: z.number().int().min(1).max(365).optional(),
    notificationEmail: z.string().email().max(320).nullable().optional(),
    emailNotifications: z.boolean().optional(),
  })
  .refine(
    v =>
      v.criticalThreshold === undefined ||
      v.warningThreshold === undefined ||
      v.criticalThreshold <= v.warningThreshold,
    { message: 'criticalThreshold, warningThreshold değerinden büyük olamaz' },
  );

function toResponse(row: {
  criticalThreshold: number;
  warningThreshold: number;
  timezone: string;
  currencyCode: string;
  leadTimeDays: number;
  targetStockDays: number;
  notificationEmail: string | null;
  emailNotifications: boolean;
}): MerchantSettingsApiResponse {
  return {
    criticalThreshold: row.criticalThreshold,
    warningThreshold: row.warningThreshold,
    timezone: row.timezone,
    currencyCode: row.currencyCode,
    leadTimeDays: row.leadTimeDays,
    targetStockDays: row.targetStockDays,
    notificationEmail: row.notificationEmail,
    emailNotifications: row.emailNotifications,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const row = await prisma.merchantSettings.findUnique({
      where: { merchantId: user.merchantId },
    });

    return NextResponse.json({ data: row ? toResponse(row) : DEFAULTS });
  } catch (error) {
    logger.error('Merchant settings GET error:', { error });
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' },
        { status: 400 },
      );
    }

    const row = await prisma.merchantSettings.upsert({
      where: { merchantId: user.merchantId },
      create: { merchantId: user.merchantId, ...parsed.data },
      update: parsed.data,
    });

    return NextResponse.json({ data: toResponse(row) });
  } catch (error) {
    logger.error('Merchant settings PUT error:', { error });
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
