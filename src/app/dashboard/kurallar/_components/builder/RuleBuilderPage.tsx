'use client';

import { useEffect, useState } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const { isDirty } = builder;

  // Kaydedilmemiş taslak varken sekme kapanır/yenilenirse tarayıcı sorsun.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

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
              <Link
                href="/dashboard/kurallar"
                onClick={event => {
                  // Kirli taslak tek tıkla gitmesin: önce sor (yeni sekmede açma serbest).
                  if (!isDirty || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  setDiscardOpen(true);
                }}
              >
                Vazgeç
              </Link>
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

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kaydedilmemiş değişiklikler silinsin mi?</DialogTitle>
            <DialogDescription>
              {mode === 'edit' ? 'Kural son kaydedilen hâliyle kalır.' : 'Taslaktaki aşamalar, koşullar ve aksiyonlar kaybolur.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" onClick={() => router.push('/dashboard/kurallar')}>
              Sil ve çık
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
