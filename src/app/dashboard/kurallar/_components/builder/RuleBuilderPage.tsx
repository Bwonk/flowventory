'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import type { RuleTemplate } from '@/lib/rules/templates';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { EditableTitle } from '@/components/shared/EditableTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTargetOptions } from '../../hooks/use-target-options';
import { FlowCanvas } from './FlowCanvas';
import { StockConsentDialog } from './StockConsentDialog';
import { useRuleBuilder } from './use-rule-builder';

interface RuleBuilderPageProps {
  token: string;
  mode: 'create' | 'edit';
  rule: TrackingRuleItem | null;
  template: RuleTemplate | null;
  notificationEmail: string | null;
  leadTimeDays: number;
  /** Başlık aksiyonlarının başına eklenir (düzenlemede "Geçmiş"). */
  extraActions?: React.ReactNode;
}

/**
 * Tam sayfa kural oluşturucu — tek kolon kanvas (`max-w-3xl`). Ad başlıkta
 * satır içi düzenlenir. Stok aksiyonu ilk kez kaydedilirken onay ister (K5).
 * Kaydet → create/update → listeye döner.
 */
export function RuleBuilderPage({ token, mode, rule, template, notificationEmail, leadTimeDays, extraActions }: RuleBuilderPageProps) {
  const router = useRouter();
  const builder = useRuleBuilder({ rule, template, leadTimeDays });
  const targets = useTargetOptions(token);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  // Kayıtlı kural zaten stok yazıyorsa onay önceden verilmiştir.
  const consentGiven = rule?.actionTypes.includes('adjust_stock') ?? false;

  const save = async (consent: boolean) => {
    const { input, issue: validationIssue } = builder.toInput(consent);
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
      setConsentOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (builder.hasStockAction && !consentGiven) {
      // Onaydan önce formu doğrula; hata varsa dialog açılmasın.
      const { issue: validationIssue } = builder.toInput(true);
      if (validationIssue) {
        setIssue(validationIssue);
        return;
      }
      setConsentOpen(true);
      return;
    }
    void save(builder.hasStockAction);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="TAKİP · KURAL"
        title={builder.state.name || 'Adsız kural'}
        titleSlot={
          <EditableTitle
            value={builder.state.name}
            onChange={name => builder.patch({ name })}
            placeholder="Adsız kural"
            aria-label="Kural adı"
          />
        }
        titleAccessory={<Badge variant="outline">{mode === 'edit' ? 'Düzenleme' : 'Taslak'}</Badge>}
        actions={
          <>
            {extraActions}
            <Button asChild variant="outline" disabled={saving}>
              <Link href="/dashboard/kurallar">Vazgeç</Link>
            </Button>
            <Button onClick={requestSave} disabled={saving}>
              {saving ? 'Kaydediliyor…' : mode === 'edit' ? 'Kaydet' : 'Kural ekle'}
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-3xl">
        <div aria-live="polite" className="mb-4 min-h-5">
          {issue && <p className="text-sm text-destructive">{issue}</p>}
        </div>
        <FlowCanvas
          builder={builder}
          products={targets.products}
          vendors={targets.vendors}
          optionsLoading={targets.loading}
          notificationEmail={notificationEmail}
        />
      </div>

      <StockConsentDialog
        open={consentOpen}
        maxRunsPerDay={builder.state.maxRunsPerDay}
        saving={saving}
        onOpenChange={setConsentOpen}
        onConfirm={() => void save(true)}
      />
    </PageContainer>
  );
}
