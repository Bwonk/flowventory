import { z } from 'zod';
import { ACTION_CATALOG } from './actions-catalog';
import { isStageOnlyMetric, METRIC_CATALOG } from './catalog';
import {
  MAX_ACTIONS,
  MAX_CONDITIONS,
  MAX_RUNS_PER_DAY_LIMIT,
  MAX_STAGES,
  MAX_STOCK,
  MAX_STOCK_STEP,
  RULE_GRANULARITIES,
  RULE_LOGICS,
  RULE_SCOPES,
  RULE_WINDOWS,
  type RuleAction,
  type RuleCondition,
  type RuleWorkflow,
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
  z.object({ metric: z.literal('stock_drop_since_stage'), threshold: units }),
  z.object({ metric: z.literal('sales_since_stage'), threshold: units }),
]);

// Tip eşitliği kontrolü: şema ile RuleCondition / RuleAction ayrışırsa derleme hatası.
type SchemaCondition = z.infer<typeof conditionSchema>;
const _checkCondition: RuleCondition = null as unknown as SchemaCondition;
void _checkCondition;

export const conditionNodeSchema = z.object({
  op: z.enum(RULE_LOGICS).default('and'),
  condition: conditionSchema,
});

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('notify') }),
  z.object({ type: z.literal('email') }),
  z.object({
    type: z.literal('adjust_stock'),
    mode: z.enum(['increase', 'set']),
    amount: z.number().int().min(1, 'Stok adedi en az 1').max(MAX_STOCK),
  }),
]);

type SchemaAction = z.infer<typeof actionSchema>;
const _checkAction: RuleAction = null as unknown as SchemaAction;
void _checkAction;

export const stageSchema = z.object({
  conditions: z.array(conditionNodeSchema).min(1, 'Her aşamada en az bir koşul olmalı').max(MAX_CONDITIONS, `Aşama başına en fazla ${MAX_CONDITIONS} koşul`),
  actions: z.array(actionSchema).min(1, 'Her aşamada en az bir aksiyon olmalı').max(MAX_ACTIONS, `Aşama başına en fazla ${MAX_ACTIONS} aksiyon`),
});

/** Yapısal workflow şeması; aşamalar arası kurallar `refineWorkflow`'da. */
export const workflowSchema = z.object({
  stages: z.array(stageSchema).min(1, 'En az bir aşama ekleyin').max(MAX_STAGES, `En fazla ${MAX_STAGES} aşama`),
});

type SchemaWorkflow = z.infer<typeof workflowSchema>;
const _checkWorkflow: RuleWorkflow = null as unknown as SchemaWorkflow;
void _checkWorkflow;

/** Aşama/koşul/aksiyon içi tutarlılık — hem kural gövdesi hem DB okuması kullanır. */
function refineWorkflow(workflow: RuleWorkflow, ctx: z.RefinementCtx, basePath: (string | number)[]) {
  workflow.stages.forEach((stage, si) => {
    stage.conditions.forEach(({ condition: c }, ci) => {
      const path = [...basePath, 'stages', si, 'conditions', ci, 'condition'];
      if (si === 0 && isStageOnlyMetric(c.metric)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'metric'],
          message: `"${METRIC_CATALOG[c.metric].label}" yalnız 2. aşamadan itibaren kullanılabilir`,
        });
      }
      if (c.metric === 'stock_drop' && c.thresholdUnit === 'percent' && c.threshold > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'threshold'], message: 'Yüzde 1–100 arasında olmalı' });
      }
    });
    const seen = new Set<string>();
    stage.actions.forEach((a, ai) => {
      const path = [...basePath, 'stages', si, 'actions', ai];
      if (seen.has(a.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'type'],
          message: `"${ACTION_CATALOG[a.type].label}" bir aşamada bir kez kullanılabilir`,
        });
      }
      seen.add(a.type);
      if (a.type === 'adjust_stock' && a.mode === 'increase' && a.amount > MAX_STOCK_STEP) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'amount'],
          message: `Tek seferde en fazla +${MAX_STOCK_STEP.toLocaleString('tr-TR')} adet`,
        });
      }
    });
  });
}

/** DB'den okunan workflow — aynı kurallar, gövde bağlamı olmadan. */
export const storedWorkflowSchema = workflowSchema.superRefine((w, ctx) => refineWorkflow(w, ctx, []));

const hasStockAction = (w: RuleWorkflow) => w.stages.some(s => s.actions.some(a => a.type === 'adjust_stock'));

/** Kural oluşturma/düzenleme gövdesi — route'larda `safeParse` ile kullanılır. */
export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Kural adı gerekli').max(80, 'Kural adı en fazla 80 karakter'),
    scope: z.enum(RULE_SCOPES),
    targetId: z.string().trim().min(1).max(120).nullable().optional(),
    targetLabel: z.string().trim().min(1).max(160).nullable().optional(),
    granularity: z.enum(RULE_GRANULARITIES).default('product'),
    workflow: workflowSchema,
    cooldownHours: windowSchema,
    resetHours: windowSchema.default(168),
    maxRunsPerDay: z.number().int().min(1).max(MAX_RUNS_PER_DAY_LIMIT).default(1),
    enabled: z.boolean().default(true),
    /**
     * Stok aksiyonu onayı (K5): kullanıcı oluşturucuda uyarıyı onayladı.
     * Saklanmaz; stok aksiyonu olan her kayıtta zorunlu.
     */
    stockWriteConsent: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.scope !== 'all' && !v.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: 'Ürün ya da tedarikçi seçin' });
    }
    refineWorkflow(v.workflow, ctx, ['workflow']);
    if (hasStockAction(v.workflow)) {
      if (v.granularity !== 'variant') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['granularity'], message: 'Stok aksiyonu varyant düzeyinde çalışır' });
      }
      if (v.stockWriteConsent !== true) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stockWriteConsent'], message: 'Stok aksiyonu için onay gerekli' });
      }
    }
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;
/** İstemcinin gönderdiği gövde (varsayılanlı alanlar opsiyonel). */
export type RuleInputBody = z.input<typeof ruleInputSchema>;
