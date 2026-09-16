import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { describeRule } from '@/lib/rules/describe';
import { ruleInputSchema } from '@/lib/rules/schema';
import type { RuleMetric, RuleScope, RuleWindowHours, ThresholdUnit } from '@/lib/rules/types';

export type TrackingRuleItem = {
  id: string;
  name: string;
  enabled: boolean;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  metric: RuleMetric;
  threshold: number;
  thresholdUnit: ThresholdUnit;
  windowHours: RuleWindowHours;
  emailEnabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  /** describeRule çıktısı — liste satırı ve bildirim aynı cümleyi kullanır. */
  sentence: string;
};

export type RulesApiResponse = { rules: TrackingRuleItem[] };

/** Merchant başına kural üst sınırı — değerlendirme maliyetini sınırlar. */
export const MAX_RULES_PER_MERCHANT = 50;

type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  targetId: string | null;
  targetLabel: string | null;
  metric: string;
  threshold: number;
  thresholdUnit: string;
  windowHours: number;
  emailEnabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

export function toRuleItem(row: RuleRow): TrackingRuleItem {
  const typed = {
    scope: row.scope as RuleScope,
    metric: row.metric as RuleMetric,
    thresholdUnit: row.thresholdUnit as ThresholdUnit,
    windowHours: row.windowHours as RuleWindowHours,
  };
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    targetId: row.targetId,
    targetLabel: row.targetLabel,
    threshold: row.threshold,
    emailEnabled: row.emailEnabled,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...typed,
    sentence: describeRule({ ...typed, targetId: row.targetId, targetLabel: row.targetLabel, threshold: row.threshold }),
  };
}

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

    const count = await prisma.trackingRule.count({ where: { merchantId: user.merchantId } });
    if (count >= MAX_RULES_PER_MERCHANT) {
      return NextResponse.json({ error: `En fazla ${MAX_RULES_PER_MERCHANT} kural tanımlayabilirsiniz` }, { status: 422 });
    }

    const { targetId, targetLabel, ...rest } = parsed.data;
    const row = await prisma.trackingRule.create({
      data: {
        merchantId: user.merchantId,
        ...rest,
        targetId: rest.scope === 'all' ? null : targetId ?? null,
        targetLabel: rest.scope === 'all' ? null : targetLabel ?? null,
      },
    });
    return NextResponse.json({ data: toRuleItem(row) }, { status: 201 });
  } catch (error) {
    logger.error('Rules POST error', { error });
    return NextResponse.json({ error: 'Kural oluşturulamadı' }, { status: 500 });
  }
}
