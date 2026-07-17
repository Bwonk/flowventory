import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
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
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const ikasClient = getIkas(authToken);
    const ordersResponse = await ikasClient.queries.listOrderForAnalytics({
      orderedAt: {
        gte: dayStart.getTime(),
        lte: dayEnd.getTime(),
      } as any,
    });

    const orders = ordersResponse.data?.listOrder?.data || [];

    const hourlyMap = new Map<number, { revenue: number; quantity: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { revenue: 0, quantity: 0 });
    }

    orders.forEach((order: any) => {
        if (!order.orderedAt) return;  // orderedAt yoksa atla
        const orderDate = new Date(order.orderedAt);
        const hour = orderDate.getHours();
        const existing = hourlyMap.get(hour)!;
      existing.revenue += order.totalFinalPrice || 0;

      const qty = (order.orderLineItems || [])
        .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
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
        date: dayStart.toISOString().split('T')[0],
        hourlyData,
      },
    });
  } catch (error) {
    console.error('Hourly analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch hourly analytics' }, { status: 500 });
  }
}
