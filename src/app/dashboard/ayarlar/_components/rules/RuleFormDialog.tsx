'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { describeRule } from '@/lib/rules/describe';
import { ruleInputSchema, type RuleInput } from '@/lib/rules/schema';
import {
  METRIC_LABELS,
  RULE_METRICS,
  RULE_WINDOWS,
  SCOPE_LABELS,
  WINDOW_LABELS,
  WINDOW_ROLE,
  type RuleMetric,
  type RuleScope,
  type RuleWindowHours,
  type ThresholdUnit,
} from '@/lib/rules/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { TargetPicker, type TargetOption } from './TargetPicker';

const SCOPE_OPTIONS: ReadonlyArray<{ value: RuleScope; label: string }> = [
  { value: 'all', label: SCOPE_LABELS.all },
  { value: 'product', label: SCOPE_LABELS.product },
  { value: 'vendor', label: SCOPE_LABELS.vendor },
];

const DROP_UNIT_OPTIONS: ReadonlyArray<{ value: 'units' | 'percent'; label: string }> = [
  { value: 'units', label: 'adet' },
  { value: 'percent', label: '%' },
];

type WindowValue = `${RuleWindowHours}`;
const WINDOW_OPTIONS: ReadonlyArray<{ value: WindowValue; label: string }> = RULE_WINDOWS.map(h => ({
  value: `${h}` as WindowValue,
  label: WINDOW_LABELS[h],
}));

/** Metrik değişince eşik birimi ve makul varsayılan. */
function defaultsFor(metric: RuleMetric, leadTimeDays: number): { threshold: number; thresholdUnit: ThresholdUnit } {
  switch (metric) {
    case 'stock_drop':
      return { threshold: 10, thresholdUnit: 'units' };
    case 'stock_below':
      return { threshold: 5, thresholdUnit: 'units' };
    case 'days_of_cover_below':
      return { threshold: Math.max(1, leadTimeDays), thresholdUnit: 'days' };
    case 'sales_above':
      return { threshold: 20, thresholdUnit: 'units' };
    case 'no_sales':
      return { threshold: 0, thresholdUnit: 'units' };
  }
}

const METRIC_HINTS: Record<RuleMetric, string> = {
  stock_drop: 'Pencere başındaki stok ile şimdiki stok karşılaştırılır (izleme başladıktan sonra).',
  stock_below: 'Anlık stok eşiğin altındaysa; pencere yeniden bildirim aralığıdır.',
  days_of_cover_below: 'Son 30 günün satış hızıyla stoğun kaç gün yeteceği; pencere yeniden bildirim aralığıdır.',
  sales_above: 'Penceredeki satış adedi (gün çözünürlüğü — 24/48 saat takvim günü sayılır).',
  no_sales: 'Pencere boyunca hiç satış yoksa ve stok varsa.',
};

interface FormState {
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  metric: RuleMetric;
  threshold: number;
  thresholdUnit: ThresholdUnit;
  windowHours: RuleWindowHours;
  emailEnabled: boolean;
}

function initialState(rule: TrackingRuleItem | null, leadTimeDays: number): FormState {
  if (rule) {
    return {
      name: rule.name,
      scope: rule.scope,
      targetId: rule.targetId,
      targetLabel: rule.targetLabel,
      metric: rule.metric,
      threshold: rule.threshold,
      thresholdUnit: rule.thresholdUnit,
      windowHours: rule.windowHours,
      emailEnabled: rule.emailEnabled,
    };
  }
  return {
    name: '',
    scope: 'all',
    targetId: null,
    targetLabel: null,
    metric: 'stock_drop',
    ...defaultsFor('stock_drop', leadTimeDays),
    windowHours: 24,
    emailEnabled: false,
  };
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  const className = 'mb-1 block text-xs text-muted-foreground';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <p className={className}>{children}</p>
  );
}

interface RuleFormDialogProps {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Düzenleme modunda mevcut kural; yoksa oluşturma. */
  rule: TrackingRuleItem | null;
  notificationEmail: string | null;
  leadTimeDays: number;
  onSubmit: (input: RuleInput) => Promise<boolean>;
}

/**
 * Kural oluştur/düzenle — cümle kurar gibi: "[Kapsam] için [metrik] [eşik]
 * [pencere] olursa bildir". Canlı önizleme describeRule ile listede görünecek
 * metnin aynısıdır.
 */
export function RuleFormDialog({ token, open, onOpenChange, rule, notificationEmail, leadTimeDays, onSubmit }: RuleFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(rule, leadTimeDays));
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [products, setProducts] = useState<TargetOption[]>([]);
  const [vendors, setVendors] = useState<TargetOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Dialog her açılışta taze form (düzenlenen kural değişmiş olabilir).
  useEffect(() => {
    if (open) {
      setForm(initialState(rule, leadTimeDays));
      setIssue(null);
    }
  }, [open, rule, leadTimeDays]);

  // Hedef listeleri: dialog açılınca bir kez.
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setOptionsLoading(true);
    Promise.all([
      ApiRequests.products.options(token).then(res => res.data?.data?.products ?? []),
      ApiRequests.vendors.list(token).then(res => res.data?.data?.vendors ?? []),
    ])
      .then(([productRows, vendorRows]) => {
        if (ignore) return;
        setProducts(productRows.map(p => ({ id: p.productId, label: p.productName, hint: `${p.totalStock} adet` })));
        // "local-" önekli yerel tedarikçilerin ürünü yoktur — kural eşleşmez, listelenmez.
        setVendors(vendorRows.filter(v => !v.vendorId.startsWith('local-')).map(v => ({ id: v.vendorId, label: v.vendorName })));
      })
      .catch(error => logger.error('Rule target options failed', { error }))
      .finally(() => {
        if (!ignore) setOptionsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [open, token]);

  const patch = useCallback((p: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...p }));
    setIssue(null);
  }, []);

  const setMetric = (metric: RuleMetric) => patch({ metric, ...defaultsFor(metric, leadTimeDays) });
  const setScope = (scope: RuleScope) => patch({ scope, targetId: null, targetLabel: null });

  const preview = useMemo(() => describeRule(form), [form]);
  const windowRole = WINDOW_ROLE[form.metric];
  const showThreshold = form.metric !== 'no_sales';
  const thresholdUnitLabel = form.thresholdUnit === 'days' ? 'gün' : form.thresholdUnit === 'percent' ? '%' : 'adet';

  const submit = async () => {
    const parsed = ruleInputSchema.safeParse({ ...form, enabled: rule?.enabled ?? true });
    if (!parsed.success) {
      setIssue(parsed.error.issues[0]?.message ?? 'Formu kontrol edin');
      return;
    }
    setSaving(true);
    const ok = await onSubmit(parsed.data);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={next => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Kuralı düzenle' : 'Yeni takip kuralı'}</DialogTitle>
          <DialogDescription>Koşul sağlanınca uygulama içi bildirim gelir; dilerseniz e-posta da.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="ruleName">Kural adı</FieldLabel>
            <Input
              id="ruleName"
              value={form.name}
              maxLength={80}
              placeholder="ör. Hızlı eriyen ürünler"
              onChange={e => patch({ name: e.target.value })}
            />
          </div>

          <div>
            <FieldLabel>Kapsam</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedTrack options={SCOPE_OPTIONS} value={form.scope} onChange={setScope} aria-label="Kural kapsamı" />
              {form.scope === 'product' && (
                <TargetPicker
                  options={products}
                  loading={optionsLoading}
                  value={form.targetId}
                  placeholder="Ürün seç"
                  searchPlaceholder="Ürün ara"
                  emptyText="Ürün bulunamadı"
                  onChange={o => patch({ targetId: o.id, targetLabel: o.label })}
                />
              )}
              {form.scope === 'vendor' && (
                <TargetPicker
                  options={vendors}
                  loading={optionsLoading}
                  value={form.targetId}
                  placeholder="Tedarikçi seç"
                  searchPlaceholder="Tedarikçi ara"
                  emptyText="Tedarikçi atanmış ürün yok"
                  onChange={o => patch({ targetId: o.id, targetLabel: o.label })}
                />
              )}
            </div>
          </div>

          <div>
            <FieldLabel>Koşul</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown label={METRIC_LABELS[form.metric]} active>
                {close =>
                  RULE_METRICS.map(m => (
                    <OptionButton
                      key={m}
                      label={METRIC_LABELS[m]}
                      selected={form.metric === m}
                      onClick={() => {
                        setMetric(m);
                        close();
                      }}
                    />
                  ))
                }
              </Dropdown>
              {showThreshold && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={form.thresholdUnit === 'percent' ? 1 : 0}
                    max={form.thresholdUnit === 'percent' ? 100 : 1_000_000}
                    value={form.threshold}
                    aria-label={`Eşik (${thresholdUnitLabel})`}
                    onChange={e => patch({ threshold: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    className="w-24 tabular-nums"
                  />
                  {form.metric === 'stock_drop' ? (
                    <SegmentedTrack
                      size="sm"
                      options={DROP_UNIT_OPTIONS}
                      value={form.thresholdUnit === 'percent' ? 'percent' : 'units'}
                      onChange={u => patch({ thresholdUnit: u })}
                      aria-label="Eşik birimi"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">{thresholdUnitLabel}</span>
                  )}
                </div>
              )}
            </div>
            <p className="mt-1 text-pretty text-xs text-muted-foreground">{METRIC_HINTS[form.metric]}</p>
          </div>

          <div>
            <FieldLabel>{windowRole === 'measure' ? 'Zaman penceresi' : 'Yeniden bildirim aralığı'}</FieldLabel>
            <SegmentedTrack
              options={WINDOW_OPTIONS}
              value={`${form.windowHours}` as WindowValue}
              onChange={v => patch({ windowHours: Number(v) as RuleWindowHours })}
              aria-label="Zaman penceresi"
            />
          </div>

          <label className="flex min-h-8 w-fit cursor-pointer items-center gap-3 text-sm text-foreground">
            <Switch
              checked={form.emailEnabled}
              disabled={!notificationEmail}
              onCheckedChange={v => patch({ emailEnabled: v })}
              aria-label="E-posta ile de bildir"
            />
            <span>
              E-posta ile de bildir
              {!notificationEmail && (
                <span className="ml-2 text-xs text-muted-foreground">(önce bildirim adresi ayarlayın)</span>
              )}
            </span>
          </label>

          <div className="rounded-md bg-muted px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Önizleme</p>
            <p className="mt-0.5 text-sm text-foreground">{preview}</p>
          </div>
        </div>

        <DialogFooter className="items-center">
          <span aria-live="polite" className="mr-auto text-sm text-destructive">
            {issue}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? 'Kaydediliyor…' : rule ? 'Kaydet' : 'Kural ekle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
