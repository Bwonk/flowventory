import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { isStockoutBeforeLeadTime } from '@/lib/reports/sell-through';
import { computeStockChange, sumProductPrevious } from '@/lib/stock-history/change';
import {
  buildProjection,
  dailyStockSeries,
  daysOfCover,
  velocityPerDay,
  VELOCITY_WINDOW_DAYS,
  type StockPoint,
} from '@/lib/stock-history/projection';
import { getStockAtOrBefore, getTrackedSince } from '@/lib/stock-history/query';
import { dateKeyInTz, dayRangeInTz, shiftDateKey } from '@/lib/timezone';

/** Kart ve grafik aynı veriden beslenir: tek istek, tek yanıt. */
export type StockHistoryApiResponse = {
  days: 30 | 90;
  current: number;
  /** `days` gün önceki stok; izleme o zaman başlamamışsa null. */
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  /** İzlemenin kaç gündür sürdüğü; kayıt yoksa null. */
  trackedSinceDays: number | null;
  velocityPerDay: number;
  daysOfCover: number | null;
  stockoutDate: string | null;
  stockoutBeforeLeadTime: boolean;
  leadTimeDays: number;
  criticalThreshold: number;
  todayKey: string;
  history: StockPoint[];
  projection: StockPoint[];
};

const querySchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  days: z.coerce.number().pipe(z.union([z.literal(30), z.literal(90)])).default(30),
});

const PROJECTION_MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { merchantId } = user;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      productId: searchParams.get('productId') ?? undefined,
      variantId: searchParams.get('variantId') ?? undefined,
      days: searchParams.get('days') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz sorgu' }, { status: 400 });
    }
    const { productId, variantId, days } = parsed.data;

    const [settings, snapshots] = await Promise.all([
      getMerchantSettings(merchantId),
      prisma.productSnapshot.findMany({
        where: { merchantId, productId, ...(variantId ? { variantId } : {}) },
        select: { variantId: true, totalStock: true },
      }),
    ]);
    if (snapshots.length === 0) {
      return NextResponse.json({ error: 'Ürün henüz senkronize edilmedi' }, { status: 404 });
    }

    const { timezone, leadTimeDays, criticalThreshold } = settings;
    const variantIds = snapshots.map(s => s.variantId);
    const current = snapshots.reduce((sum, s) => sum + s.totalStock, 0);

    const now = new Date();
    const todayKey = dateKeyInTz(now, timezone);
    const fromKey = shiftDateKey(todayKey, -days);
    const windowStart = new Date(dayRangeInTz(fromKey, timezone).startMs);
    const previousAt = new Date(now.getTime() - days * DAY_MS);
    const salesFromKey = shiftDateKey(todayKey, -(VELOCITY_WINDOW_DAYS - 1));

    const [windowRecords, carriedIn, previousMap, trackedSince, sales] = await Promise.all([
      prisma.stockHistory.findMany({
        where: { merchantId, variantId: { in: variantIds }, recordedAt: { gte: windowStart } },
        select: { variantId: true, totalStock: true, recordedAt: true },
      }),
      // Pencere başında geçerli olan değerler (pencereden önce yazılmış son kayıt).
      getStockAtOrBefore(merchantId, new Date(windowStart.getTime() - 1), variantIds),
      getStockAtOrBefore(merchantId, previousAt, variantIds),
      getTrackedSince(merchantId, productId, variantId),
      prisma.salesDaily.aggregate({
        where: { merchantId, variantId: { in: variantIds }, date: { gte: salesFromKey } },
        _sum: { quantity: true },
      }),
    ]);

    const records = [
      ...Array.from(carriedIn.entries()).map(([vid, totalStock]) => ({
        variantId: vid,
        totalStock,
        recordedAt: new Date(windowStart.getTime() - 1),
      })),
      ...windowRecords,
    ];
    const history = dailyStockSeries(records, fromKey, todayKey, current, timezone);

    const previous = sumProductPrevious(variantIds.map(vid => previousMap.get(vid) ?? null));
    const change = computeStockChange(previous, current);

    const velocity = velocityPerDay(sales._sum.quantity ?? 0, VELOCITY_WINDOW_DAYS);
    const cover = daysOfCover(current, velocity);
    const projection = buildProjection(current, velocity, todayKey, PROJECTION_MAX_DAYS);

    const trackedSinceDays = trackedSince
      ? Math.floor((now.getTime() - trackedSince.getTime()) / DAY_MS)
      : null;

    const data: StockHistoryApiResponse = {
      days,
      current,
      previous,
      delta: change.delta,
      deltaPct: change.deltaPct,
      trackedSinceDays,
      velocityPerDay: Math.round(velocity * 100) / 100,
      daysOfCover: cover,
      stockoutDate: projection.stockoutDate,
      stockoutBeforeLeadTime: isStockoutBeforeLeadTime(cover, leadTimeDays),
      leadTimeDays,
      criticalThreshold,
      todayKey,
      history,
      projection: projection.points,
    };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Stock history failed', { error });
    return NextResponse.json({ error: 'Stok geçmişi alınamadı' }, { status: 500 });
  }
}
