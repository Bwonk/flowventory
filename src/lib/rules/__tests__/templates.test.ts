import { describe, expect, it } from 'vitest';
import { hasActionType } from '@/lib/rules/actions-catalog';
import { ruleInputSchema } from '@/lib/rules/schema';
import { findTemplate, RULE_TEMPLATES } from '@/lib/rules/templates';

describe('kural şablonları', () => {
  it.each(RULE_TEMPLATES.map(t => [t.key, t] as const))('%s ruleInputSchema\'dan geçer', (_key, template) => {
    const r = ruleInputSchema.safeParse({ ...template.rule, scope: 'all', stockWriteConsent: true });
    expect(r.success ? null : r.error.issues[0]?.message).toBeNull();
  });
  it('anahtarlar tekil; stok aksiyonlu şablon varyant düzeyinde', () => {
    expect(new Set(RULE_TEMPLATES.map(t => t.key)).size).toBe(RULE_TEMPLATES.length);
    for (const t of RULE_TEMPLATES) {
      if (hasActionType(t.rule.workflow, 'adjust_stock')) expect(t.rule.granularity).toBe('variant');
    }
  });
  it('findTemplate', () => {
    expect(findTemplate('auto-restock')?.name).toBe('Kritik stokta otomatik stok ekle');
    expect(findTemplate('yok')).toBeNull();
    expect(findTemplate(null)).toBeNull();
  });
});
