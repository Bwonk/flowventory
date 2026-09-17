import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { ruleInputSchema } from '@/lib/rules/schema';
import { ruleDataFromInput, toEventItem, toRuleItem, type RuleEventItem, type TrackingRuleItem } from '@/lib/rules/serialize';

type RouteContext = { params: Promise<{ id: string }> };

export type RuleDetailApiResponse = { rule: TrackingRuleItem; events: RuleEventItem[] };

/** Yalnız etkin/pasif değişimi ya da tam gövde. */
const toggleSchema = z.object({ enabled: z.boolean() }).strict();

const EVENT_LIMIT = 20;

/** GET /api/rules/:id — kural + son tetiklenmeler (düzenleme sayfası). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;

    const row = await prisma.trackingRule.findFirst({ where: { id, merchantId: user.merchantId } });
    if (!row) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });
    const events = await prisma.trackingRuleEvent.findMany({
      where: { merchantId: user.merchantId, ruleId: id },
      orderBy: { createdAt: 'desc' },
      take: EVENT_LIMIT,
    });
    const data: RuleDetailApiResponse = { rule: toRuleItem(row), events: events.map(toEventItem) };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Rules GET one error', { error });
    return NextResponse.json({ error: 'Kural alınamadı' }, { status: 500 });
  }
}

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
      if (parsed.data.channel === 'email') {
        const { notificationEmail } = await getMerchantSettings(user.merchantId);
        if (!notificationEmail) {
          return NextResponse.json({ error: 'E-posta kuralı için önce bildirim adresi kaydedin.' }, { status: 422 });
        }
      }
      data = ruleDataFromInput(parsed.data);
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

/** DELETE /api/rules/:id — tetik geçmişi cascade ile silinir. */
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
