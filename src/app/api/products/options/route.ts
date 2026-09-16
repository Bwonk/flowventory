import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export type ProductOption = { productId: string; productName: string; totalStock: number };
export type ProductOptionsApiResponse = { products: ProductOption[] };

/**
 * GET /api/products/options — seçiciler için hafif ürün listesi (snapshot'tan;
 * canlı list-products'a göre ucuz). Ürün adına göre sıralı.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await prisma.productSnapshot.groupBy({
      by: ['productId', 'productName'],
      where: { merchantId: user.merchantId },
      _sum: { totalStock: true },
    });
    const products: ProductOption[] = rows
      .map(r => ({ productId: r.productId, productName: r.productName, totalStock: r._sum.totalStock ?? 0 }))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
    const data: ProductOptionsApiResponse = { products };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Product options error', { error });
    return NextResponse.json({ error: 'Ürünler alınamadı' }, { status: 500 });
  }
}
