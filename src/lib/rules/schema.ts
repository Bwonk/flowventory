import { z } from 'zod';
import { METRIC_CATALOG } from './catalog';
import {
  MAX_CONDITIONS,
  RULE_CHANNELS,
  RULE_DOMAINS,
  RULE_LOGICS,
  RULE_SCOPES,
  RULE_WINDOWS,
  type RuleCondition,
} from './types';

const windowSchema = z.union([
  z.literal(RULE_WINDOWS[0]),
  z.literal(RULE_WINDOWS[1]),
  z.literal(RULE_WINDOWS[2]),
  z.literal(RULE_WINDOWS[3]),
  z.literal(RULE_WINDOWS[4]),
]);

const units = z.number().int().min(1).max(1_000_000);

/** Koşul gövdesi — metriğe göre ayrışır; `RuleCondition` ile birebir. */
export const conditionSchema = z.discriminatedUnion('metric', [
  z.object({
    metric: z.literal('stock_drop'),
    threshold: z.number().int().min(1).max(1_000_000),
    thresholdUnit: z.enum(['units', 'percent']),
    windowHours: windowSchema,
  }),
  z.object({ metric: z.literal('stock_below'), threshold: units }),
  z.object({ metric: z.literal('days_of_cover_below'), threshold: z.number().int().min(1).max(730) }),
  z.object({ metric: z.literal('sales_above'), threshold: units, windowHours: windowSchema }),
  z.object({ metric: z.literal('no_sales'), windowHours: windowSchema }),
  z.object({ metric: z.literal('reorder_point_reached') }),
  z.object({ metric: z.literal('below_safety_stock') }),
  z.object({ metric: z.literal('suggested_qty_above'), threshold: units }),
  z.object({ metric: z.literal('stockout_before_lead_time') }),
  z.object({ metric: z.literal('sell_through_band_is'), value: z.enum(['yüksek', 'normal', 'düşük', 'satışsız']) }),
  z.object({ metric: z.literal('aging_bucket_is'), value: z.enum(['0-30', '31-60', '61-90', '91-180', '180+', 'satışsız']) }),
  z.object({ metric: z.literal('abc_class_is'), value: z.enum(['A', 'B', 'C']) }),
  z.object({ metric: z.literal('action_is'), value: z.enum(['siparis-ver', 'eritme-adayi', 'fazla-stok']) }),
]);

// Tip eşitliği kontrolü: şema ile RuleCondition ayrışırsa derleme hatası.
type SchemaCondition = z.infer<typeof conditionSchema>;
const _check: RuleCondition = null as unknown as SchemaCondition;
void _check;

export const conditionsSchema = z.array(conditionSchema).min(1, 'En az bir koşul ekleyin').max(MAX_CONDITIONS, `En fazla ${MAX_CONDITIONS} koşul`);

/** Kural oluşturma/düzenleme gövdesi — route'larda `safeParse` ile kullanılır. */
export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Kural adı gerekli').max(80, 'Kural adı en fazla 80 karakter'),
    domain: z.enum(RULE_DOMAINS),
    channel: z.enum(RULE_CHANNELS),
    logic: z.enum(RULE_LOGICS).default('and'),
    scope: z.enum(RULE_SCOPES),
    targetId: z.string().trim().min(1).max(120).nullable().optional(),
    targetLabel: z.string().trim().min(1).max(160).nullable().optional(),
    cooldownHours: windowSchema,
    conditions: conditionsSchema,
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.scope !== 'all' && !v.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: 'Ürün ya da tedarikçi seçin' });
    }
    v.conditions.forEach((c, i) => {
      if (METRIC_CATALOG[c.metric].domain !== v.domain) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['conditions', i, 'metric'],
          message: `"${METRIC_CATALOG[c.metric].label}" bu alanda kullanılamaz`,
        });
      }
      if (c.metric === 'stock_drop' && c.thresholdUnit === 'percent' && c.threshold > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conditions', i, 'threshold'], message: 'Yüzde 1–100 arasında olmalı' });
      }
    });
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;
