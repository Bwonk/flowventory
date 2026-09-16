import { z } from 'zod';
import { RULE_METRICS, RULE_SCOPES, RULE_WINDOWS, THRESHOLD_UNITS } from './types';

/** Kural oluşturma/düzenleme gövdesi — route'larda `safeParse` ile kullanılır. */
export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Kural adı gerekli').max(80, 'Kural adı en fazla 80 karakter'),
    scope: z.enum(RULE_SCOPES),
    targetId: z.string().trim().min(1).max(120).nullable().optional(),
    targetLabel: z.string().trim().min(1).max(160).nullable().optional(),
    metric: z.enum(RULE_METRICS),
    threshold: z.number().int().min(0).max(1_000_000),
    thresholdUnit: z.enum(THRESHOLD_UNITS).default('units'),
    windowHours: z.union([
      z.literal(RULE_WINDOWS[0]),
      z.literal(RULE_WINDOWS[1]),
      z.literal(RULE_WINDOWS[2]),
      z.literal(RULE_WINDOWS[3]),
      z.literal(RULE_WINDOWS[4]),
    ]),
    emailEnabled: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.scope !== 'all' && !v.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: 'Ürün ya da tedarikçi seçin' });
    }
    if (v.metric === 'stock_drop') {
      if (v.thresholdUnit === 'days') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['thresholdUnit'], message: 'Stok düşüşü adet ya da yüzde ile ölçülür' });
      }
      if (v.thresholdUnit === 'percent' && (v.threshold < 1 || v.threshold > 100)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['threshold'], message: 'Yüzde 1–100 arasında olmalı' });
      }
      if (v.thresholdUnit === 'units' && v.threshold < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['threshold'], message: 'Eşik en az 1 adet olmalı' });
      }
    } else if (v.metric === 'days_of_cover_below') {
      if (v.thresholdUnit !== 'days') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['thresholdUnit'], message: 'Stok ömrü gün ile ölçülür' });
      }
      if (v.threshold < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['threshold'], message: 'Eşik en az 1 gün olmalı' });
      }
    } else if (v.metric === 'no_sales') {
      // threshold anlamsız; 0 kabul.
    } else if (v.thresholdUnit !== 'units') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['thresholdUnit'], message: 'Bu metrik adet ile ölçülür' });
    } else if (v.threshold < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['threshold'], message: 'Eşik en az 1 adet olmalı' });
    }
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;
