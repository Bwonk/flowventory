import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { ruleInputSchema } from '@/lib/rules/schema';
import { MAX_RULES_PER_MERCHANT, ruleDataFromInput, toRuleItem, type TrackingRuleItem } from '@/lib/rules/serialize';

export type { TrackingRuleItem };
export type RulesApiResponse = { rules: TrackingRuleItem[] };

/** GET /api/rules — merchant'ın takip kuralları (yeniden eskiye). */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await prisma.trackingRule.findMany({
      where: { merchantId: user.merchantId },
      orderBy: { createdAt: 'desc' },
    });
    const data: RulesApiResponse = { rules: rows.map(toRuleItem) };
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Rules GET error', { error });
    return NextResponse.json({ error: 'Kurallar alınamadı' }, { status: 500 });
  }
}

/** POST /api/rules — yeni kural. */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = ruleInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi' }, { status: 400 });
    }

    if (parsed.data.channel === 'email') {
      const { notificationEmail } = await getMerchantSettings(user.merchantId);
      if (!notificationEmail) {
        return NextResponse.json({ error: 'E-posta kuralı için önce bildirim adresi kaydedin.' }, { status: 422 });
      }
    }

    const count = await prisma.trackingRule.count({ where: { merchantId: user.merchantId } });
    if (count >= MAX_RULES_PER_MERCHANT) {
      return NextResponse.json({ error: `En fazla ${MAX_RULES_PER_MERCHANT} kural tanımlayabilirsiniz` }, { status: 422 });
    }

    const row = await prisma.trackingRule.create({
      data: { merchantId: user.merchantId, ...ruleDataFromInput(parsed.data) },
    });
    return NextResponse.json({ data: toRuleItem(row) }, { status: 201 });
  } catch (error) {
    logger.error('Rules POST error', { error });
    return NextResponse.json({ error: 'Kural oluşturulamadı' }, { status: 500 });
  }
}
