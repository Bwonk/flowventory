import { logger } from '@/lib/logger';
import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { fetchAllPages } from '@/lib/ikas-client/pagination';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { buildMockHourlyAnalytics } from '@/lib/mock-analytics';
import { getMerchantTimezone } from '@/lib/merchant-settings';
import { dateKeyInTz, dayRangeInTz, hourInTz } from '@/lib/timezone';
import { NextRequest, NextResponse } from 'next/server';

export type HourlyAnalyticsApiResponse = {
  date: string;
  hourlyData: Array<{
    hour: number;
    label: string;
    revenue: number;
    quantity: number;
  }>;
};

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    // Gün sınırları merchant TZ'de hesaplanır ("2026-08-11" = o TZ'nin günü).
    const timezone = await getMerchantTimezone(user.merchantId);
    const dateStr = searchParams.get('date') ?? dateKeyInTz(new Date(), timezone);
    const { startMs, endMs } = dayRangeInTz(dateStr, timezone);

    const ikasClient = getIkas(authToken);
    const { items: orders } = await fetchAllPages(async pagination => {
      const res = await ikasClient.queries.listOrderForAnalytics({
        orderedAt: {
          gte: startMs,
          lte: endMs,
        },
        pagination,
      });
      return res.isSuccess ? res.data?.listOrder : null;
    });

    const useMock =
      process.env.NODE_ENV !== 'production' &&
      (searchParams.get('mock') === '1' ||
        process.env.MOCK_ANALYTICS === '1' ||
        orders.length === 0);

    if (useMock) {
      return NextResponse.json({
        data: { date: dateStr, hourlyData: buildMockHourlyAnalytics(dateStr) },
        meta: { mocked: true },
      });
    }

    const hourlyMap = new Map<number, { revenue: number; quantity: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { revenue: 0, quantity: 0 });
    }

    orders.forEach((order) => {
      if (!order.orderedAt) return;
      // Saat bucket'ı merchant TZ'de (sunucu yerel saati değil).
      const hour = hourInTz(order.orderedAt, timezone);
      const existing = hourlyMap.get(hour)!;
      existing.revenue += order.totalFinalPrice || 0;

      const qty = (order.orderLineItems || [])
        .reduce((sum: number, item) => sum + (item.quantity || 0), 0);
      existing.quantity += qty;
    });

    const hourlyData = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        revenue: Math.round(data.revenue * 100) / 100,
        quantity: data.quantity,
      }))
      .sort((a, b) => a.hour - b.hour);

    return NextResponse.json({
      data: {
        date: dateStr,
        hourlyData,
      },
    });
  } catch (error) {
    logger.error('Hourly analytics error:', { error });
    return NextResponse.json({ error: 'Failed to fetch hourly analytics' }, { status: 500 });
  }
}
