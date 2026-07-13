import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export type SingleProductViewStats = {
  totalViews: number;
  dailyViews: Array<{ date: string; viewCount: number }>;
};

export type BatchViewStatsResponse = {
  [productId: string]: number;
};

export type ViewStatsApiResponse = SingleProductViewStats | BatchViewStatsResponse;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (productId) {
      const dailyViews = await prisma.productView.findMany({
        where: { productId },
        orderBy: { date: 'asc' },
      });

      const totalViews = dailyViews.reduce((sum, row) => sum + row.viewCount, 0);

      const data: SingleProductViewStats = {
        totalViews,
        dailyViews: dailyViews.map((row) => ({
          date: row.date,
          viewCount: row.viewCount,
        })),
      };

      return NextResponse.json({ data });
    }

    const aggregated = await prisma.productView.groupBy({
      by: ['productId'],
      _sum: { viewCount: true },
      orderBy: { productId: 'asc' },
    });

    const data: BatchViewStatsResponse = {};
    for (const row of aggregated) {
      data[row.productId] = row._sum.viewCount ?? 0;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Product view stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
