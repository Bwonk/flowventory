'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import type { RuleEventItem } from '@/lib/rules/serialize';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { DOMAIN_LABELS, type RuleChannel, type RuleDomain } from '@/lib/rules/types';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTargetOptions } from '../../hooks/use-target-options';
import { FlowCanvas } from './FlowCanvas';
import { RuleMetaPanel } from './RuleMetaPanel';
import { useRuleBuilder } from './use-rule-builder';

interface RuleBuilderPageProps {
  token: string;
  mode: 'create' | 'edit';
  rule: TrackingRuleItem | null;
  events?: RuleEventItem[];
  channel: RuleChannel;
  domain: RuleDomain;
  notificationEmail: string | null;
  leadTimeDays: number;
}

/**
 * Tam sayfa kural oluşturucu: sol meta paneli + sağda akış kanvası.
 * Kaydet → create/update → listeye döner.
 */
export function RuleBuilderPage({ token, mode, rule, events, channel, domain, notificationEmail, leadTimeDays }: RuleBuilderPageProps) {
  const router = useRouter();
  const builder = useRuleBuilder({ rule, channel, domain, leadTimeDays });
  const targets = useTargetOptions(token);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  const productCountHint =
    builder.state.scope === 'all' && !targets.loading ? `${targets.products.length} ürün izlenir` : undefined;

  const save = async () => {
    const { input, issue: validationIssue } = builder.toInput();
    if (!input) {
      setIssue(validationIssue);
      return;
    }
    setIssue(null);
    setSaving(true);
    try {
      const res = rule ? await ApiRequests.rules.update(token, rule.id, input) : await ApiRequests.rules.create(token, input);
      const item = res.data?.data;
      if (!item) throw new Error('empty rule response');
      toast.success(rule ? `Kural güncellendi: ${item.name}` : `Kural eklendi: ${item.name}`);
      router.push('/dashboard/kurallar');
    } catch (error) {
      logger.error('Rule save failed', { error });
      setIssue(extractErrorMessage(error, rule ? 'Kural güncellenemedi.' : 'Kural eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`TAKİP · ${DOMAIN_LABELS[builder.state.domain].toLocaleUpperCase('tr')}`}
        title={builder.state.name.trim() || (mode === 'edit' ? 'Kuralı düzenle' : 'Yeni kural')}
        titleAccessory={<Badge variant="outline">{mode === 'edit' ? 'Düzenleme' : 'Taslak'}</Badge>}
        actions={
          <>
            <Button asChild variant="outline" disabled={saving}>
              <Link href="/dashboard/kurallar">Vazgeç</Link>
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Kaydediliyor…' : mode === 'edit' ? 'Kaydet' : 'Kural ekle'}
            </Button>
          </>
        }
      />

      <div aria-live="polite" className="mb-4 min-h-5">
        {issue && <p className="text-sm text-destructive">{issue}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <RuleMetaPanel
          state={builder.state}
          patch={builder.patch}
          setScope={builder.setScope}
          products={targets.products}
          vendors={targets.vendors}
          optionsLoading={targets.loading}
          notificationEmail={notificationEmail}
          events={mode === 'edit' ? events ?? [] : undefined}
        />
        <FlowCanvas
          state={builder.state}
          availableMetrics={builder.availableMetrics}
          productCountHint={productCountHint}
          onLogicChange={logic => builder.patch({ logic })}
          onAddCondition={() => builder.addCondition()}
          onSetMetric={builder.setMetric}
          onUpdateCondition={builder.updateCondition}
          onRemoveCondition={builder.removeCondition}
        />
      </div>
    </PageContainer>
  );
}
