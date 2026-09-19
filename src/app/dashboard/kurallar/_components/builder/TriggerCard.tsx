'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BoltIcon } from '@/components/ui/icons/bolt';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { describeScope } from '@/lib/rules/describe';
import { GRANULARITY_LABELS, SCOPE_LABELS, type RuleGranularity, type RuleScope } from '@/lib/rules/types';
import { TargetPicker, type TargetOption } from '../TargetPicker';
import { CARD, Eyebrow } from './flow-primitives';
import type { BuilderState } from './use-rule-builder';

const SCOPE_OPTIONS: ReadonlyArray<{ value: RuleScope; label: string }> = [
  { value: 'all', label: SCOPE_LABELS.all },
  { value: 'product', label: SCOPE_LABELS.product },
  { value: 'vendor', label: SCOPE_LABELS.vendor },
];
const GRANULARITY_OPTIONS: ReadonlyArray<{ value: RuleGranularity; label: string }> = [
  { value: 'product', label: GRANULARITY_LABELS.product },
  { value: 'variant', label: GRANULARITY_LABELS.variant },
];

interface TriggerCardProps {
  state: BuilderState;
  hasStockAction: boolean;
  products: TargetOption[];
  vendors: TargetOption[];
  optionsLoading: boolean;
  onScopeChange: (scope: RuleScope) => void;
  onPatch: (patch: Partial<BuilderState>) => void;
}

/**
 * Tetikleyici: kapsam cümlesi + "Değiştir" → kart içinde kapsam, hedef ve
 * değerlendirme birimi. Varsayılan kapalı; hedef seçilmemişse açık başlar.
 */
export function TriggerCard({ state, hasStockAction, products, vendors, optionsLoading, onScopeChange, onPatch }: TriggerCardProps) {
  const [open, setOpen] = useState(state.scope !== 'all' && !state.targetId);
  const bolt = useIconHover();
  const granularity = hasStockAction ? 'variant' : state.granularity;
  const countHint =
    state.scope === 'all' && !optionsLoading && products.length > 0
      ? `${products.length} ürün izlenir${granularity === 'variant' ? ' · her varyant ayrı değerlendirilir' : ''}`
      : granularity === 'variant'
        ? 'Her varyant ayrı değerlendirilir'
        : null;

  return (
    <section className={CARD} aria-label="Tetikleyici" {...bolt.hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BoltIcon ref={bolt.ref} size={16} className="flex shrink-0 text-muted-foreground" aria-hidden />
            <Eyebrow>Tetikleyici</Eyebrow>
          </div>
          <p className="mt-1 text-sm text-foreground">{describeScope(state)}</p>
          {countHint && <p className="mt-0.5 text-xs text-muted-foreground">{countHint}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 -mt-1 shrink-0"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Kapat' : 'Değiştir'}
        </Button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-hairline pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTrack size="sm" options={SCOPE_OPTIONS} value={state.scope} onChange={onScopeChange} aria-label="Kural kapsamı" />
            {state.scope === 'product' && (
              <TargetPicker
                options={products}
                loading={optionsLoading}
                value={state.targetId}
                placeholder="Ürün seç"
                searchPlaceholder="Ürün ara"
                emptyText="Ürün bulunamadı"
                onChange={o => onPatch({ targetId: o.id, targetLabel: o.label })}
              />
            )}
            {state.scope === 'vendor' && (
              <TargetPicker
                options={vendors}
                loading={optionsLoading}
                value={state.targetId}
                placeholder="Tedarikçi seç"
                searchPlaceholder="Tedarikçi ara"
                emptyText="Tedarikçi atanmış ürün yok"
                onChange={o => onPatch({ targetId: o.id, targetLabel: o.label })}
              />
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Değerlendirme birimi</p>
            <SegmentedTrack
              size="sm"
              options={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={g => !hasStockAction && onPatch({ granularity: g })}
              aria-label="Değerlendirme birimi"
              className={hasStockAction ? 'pointer-events-none opacity-60' : undefined}
            />
            {hasStockAction && <p className="mt-1 text-xs text-muted-foreground">Stok aksiyonu varyant düzeyinde çalışır.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
