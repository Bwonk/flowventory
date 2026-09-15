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
        where: { merchantId: user.merchantId, dismissedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { merchantId: user.merchantId, readAt: null, dismissedAt: null },
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

const markReadSchema = z
  .object({
    /** Belirli id'ler; boş/verilmemişse tümü okundu sayılır. */
    ids: z.array(z.string()).optional(),
    /** false → okunmadı işaretle (yalnız belirli id'lerle; "tümünü okunmadı" yok). */
    read: z.boolean().optional(),
  })
  .refine(v => v.read !== false || (v.ids?.length ?? 0) > 0, {
    message: 'Okunmadı işaretleme için id gerekir',
  });

/**
 * POST /api/notifications — okundu / okunmadı işaretle.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = markReadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    const unread = parsed.data.read === false;
    await prisma.notification.updateMany({
      where: {
        merchantId: user.merchantId,
        dismissedAt: null,
        readAt: unread ? { not: null } : null,
        ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : {}),
      },
      data: { readAt: unread ? null : new Date() },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error('Notifications mark-read error', { error });
    return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 });
  }
}

const dismissSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

/**
 * DELETE /api/notifications — kaldır (soft delete: dismissedAt). Kayıt silinmez;
 * dedupeKey kaldığı için aynı uyarı aynı periyotta yeniden üretilmez.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = dismissSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: {
        merchantId: user.merchantId,
        id: { in: parsed.data.ids },
        dismissedAt: null,
      },
      data: { dismissedAt: new Date() },
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error('Notifications dismiss error', { error });
    return NextResponse.json({ error: 'Failed to dismiss notifications' }, { status: 500 });
  }
}
