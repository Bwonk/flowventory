'use client';

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { AdjustmentsHorizontalIcon } from '@/components/ui/icons/adjustments-horizontal';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ReportParamsPopoverProps {
  leadTimeDays: number;
  targetStockDays: number;
  /** Kaydeder ve raporu yeniden hesaplatır; hata fırlatırsa popover açık kalır. */
  onApply: (leadTimeDays: number, targetStockDays: number) => Promise<void>;
}

/**
 * Rapor hesap parametreleri (tedarik süresi + hedef stok). Eski hali sayfanın
 * üst bandını kaplayan kalıcı bir formdu; nadir kullanılan ayar başlık
 * aksiyonlarındaki popover'a taşındı — trigger mevcut değerleri veri olarak
 * gösterir, düzenleme tek tık uzakta.
 */
export function ReportParamsPopover({ leadTimeDays, targetStockDays, onApply }: ReportParamsPopoverProps) {
  const { ref: paramsRef, hoverProps: paramsHoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [leadDraft, setLeadDraft] = useState(leadTimeDays);
  const [targetDraft, setTargetDraft] = useState(targetStockDays);
  const [saving, setSaving] = useState(false);

  const dirty = leadDraft !== leadTimeDays || targetDraft !== targetStockDays;

  const apply = async () => {
    setSaving(true);
    try {
      await onApply(leadDraft, targetDraft);
      setOpen(false);
    } catch (error) {
      logger.error('Error saving report settings', { error });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (saving) return;
        setOpen(next);
        if (next) {
          // Popover her açılışta kayıtlı değerlerden başlar.
          setLeadDraft(leadTimeDays);
          setTargetDraft(targetStockDays);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="segment" size="segment" aria-label="Hesap parametreleri" {...paramsHoverProps}>
          <AdjustmentsHorizontalIcon
            ref={paramsRef}
            size={12}
            className="flex shrink-0 [&>svg]:size-3!"
            aria-hidden
          />
          <span className="font-mono text-xs tabular-nums">
            {leadTimeDays}g · {targetStockDays}g
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 rounded-lg p-3">
        <PopoverHeader>
          <PopoverTitle>Hesap parametreleri</PopoverTitle>
        </PopoverHeader>
        <div className="mt-2 space-y-2.5">
          <div>
            <label htmlFor="params-lead-time" className="mb-1 block text-xs text-muted-foreground">
              Tedarik süresi (gün)
            </label>
            <Input
              id="params-lead-time"
              type="number"
              min={0}
              max={365}
              value={leadDraft}
              onChange={e => setLeadDraft(Math.max(0, Number(e.target.value) || 0))}
              className="h-8 text-sm"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="params-target-days" className="mb-1 block text-xs text-muted-foreground">
              Hedef stok (gün)
            </label>
            <Input
              id="params-target-days"
              type="number"
              min={1}
              max={365}
              value={targetDraft}
              onChange={e => setTargetDraft(Math.max(1, Number(e.target.value) || 1))}
              className="h-8 text-sm"
              disabled={saving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Öneri = günlük satış × (hedef + tedarik süresi) + emniyet stoğu − mevcut stok, 5&apos;in
            katına yuvarlanır.
          </p>
          <Button type="button" size="sm" onClick={apply} disabled={!dirty || saving} className="w-full">
            {saving ? 'Hesaplanıyor…' : 'Uygula'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
