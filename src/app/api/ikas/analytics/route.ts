import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

export type AnalyticsApiResponse = {
  totalRevenue: number;
  revenueChange: number;
  dailyRevenue: Array<{ date: string; revenue: number }>;
  topProducts: Array<{ variantId: string; sku: string; revenue: number; quantity: number }>;
};

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const ikasClient = getIkas(authToken);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const recentOrders = await ikasClient.queries.listOrderForAnalytics({
      orderedAt: { gte: thirtyDaysAgo.toISOString() },
    });

    const previousOrders = await ikasClient.queries.listOrderForAnalytics({
      orderedAt: {
        gte: sixtyDaysAgo.toISOString(),
        lte: thirtyDaysAgo.toISOString(),
      },
    });

    const recentData = recentOrders.data?.listOrder?.data || [];
    const previousData = previousOrders.data?.listOrder?.data || [];

    const totalRevenue = recentData.reduce((sum: number, order: any) => 
      sum + (order.totalFinalPrice || 0), 0);
    const previousRevenue = previousData.reduce((sum: number, order: any) => 
      sum + (order.totalFinalPrice || 0), 0);

    const revenueChange = previousRevenue === 0 ? 0 :
      Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100);

    const dailyMap = new Map<string, number>();
    recentData.forEach((order: any) => {
      const date = new Date(order.orderedAt).toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + (order.totalFinalPrice || 0));
    });

    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const productMap = new Map<string, { sku: string; revenue: number; quantity: number }>();
    recentData.forEach((order: any) => {
      order.orderLineItems?.forEach((item: any) => {
        const id = item.variant?.id || '';
        const existing = productMap.get(id) || { 
          sku: item.variant?.sku || id, 
          revenue: 0, 
          quantity: 0 
        };
        existing.revenue += (item.finalPrice || 0) * (item.quantity || 1);
        existing.quantity += item.quantity || 1;
        productMap.set(id, existing);
      });
    });

    const topProducts = Array.from(productMap.entries())
      .map(([variantId, data]) => ({ variantId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({ 
      data: { totalRevenue, revenueChange, dailyRevenue, topProducts } 
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}