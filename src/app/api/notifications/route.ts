import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  productId: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationsApiResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

/**
 * GET /api/notifications — son 50 bildirim + okunmamış sayısı.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { merchantId: user.merchantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { merchantId: user.merchantId, readAt: null },
      }),
    ]);

    const data: NotificationsApiResponse = {
      items: rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        productId: row.productId,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      })),
      unreadCount,
    };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Notifications GET error', { error });
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

const markReadSchema = z.object({
  /** Belirli id'ler; boş/verilmemişse tümü okundu sayılır. */
  ids: z.array(z.string()).optional(),
});

/**
 * POST /api/notifications — okundu işaretle.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = markReadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: {
        merchantId: user.merchantId,
        readAt: null,
        ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error('Notifications mark-read error', { error });
    return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 });
  }
}
