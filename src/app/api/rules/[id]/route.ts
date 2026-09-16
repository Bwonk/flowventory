import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { ruleInputSchema } from '@/lib/rules/schema';
import { toRuleItem } from '../route';

type RouteContext = { params: Promise<{ id: string }> };

/** Yalnız etkin/pasif değişimi ya da tam gövde. */
const toggleSchema = z.object({ enabled: z.boolean() }).strict();

/** PUT /api/rules/:id — tam güncelleme ya da { enabled } ile aç/kapa. */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;

    const body: unknown = await request.json().catch(() => null);
    const toggle = toggleSchema.safeParse(body);
    let data: Record<string, unknown>;
    if (toggle.success) {
      data = toggle.data;
    } else {
      const parsed = ruleInputSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' }, { status: 400 });
      }
      const { targetId, targetLabel, ...rest } = parsed.data;
      data = {
        ...rest,
        targetId: rest.scope === 'all' ? null : targetId ?? null,
        targetLabel: rest.scope === 'all' ? null : targetLabel ?? null,
      };
    }

    // Sahiplik: id başka merchant'a aitse count 0 → 404 (var/yok sızdırmaz).
    const { count } = await prisma.trackingRule.updateMany({ where: { id, merchantId: user.merchantId }, data });
    if (count === 0) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });

    const row = await prisma.trackingRule.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });
    return NextResponse.json({ data: toRuleItem(row) });
  } catch (error) {
    logger.error('Rules PUT error', { error });
    return NextResponse.json({ error: 'Kural güncellenemedi' }, { status: 500 });
  }
}

/** DELETE /api/rules/:id */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;

    const { count } = await prisma.trackingRule.deleteMany({ where: { id, merchantId: user.merchantId } });
    if (count === 0) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    logger.error('Rules DELETE error', { error });
    return NextResponse.json({ error: 'Kural silinemedi' }, { status: 500 });
  }
}
