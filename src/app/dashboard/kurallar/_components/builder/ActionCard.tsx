'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { ExclamationTriangleIcon } from '@/components/ui/icons/exclamation-triangle';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { ACTION_CATALOG, STOCK_MODE_LABELS } from '@/lib/rules/actions-catalog';
import { MAX_STOCK, MAX_STOCK_STEP, RULE_ACTION_TYPES, STOCK_ADJUST_MODES, type RuleAction, type RuleActionType } from '@/lib/rules/types';
import { ActionIcon } from '../ActionIcon';
import { CARD, Eyebrow, RemoveButton } from './flow-primitives';

const MODE_OPTIONS = STOCK_ADJUST_MODES.map(m => ({ value: m, label: STOCK_MODE_LABELS[m] }));

interface ActionCardProps {
  index: number;
  action: RuleAction;
  /** Aynı aşamada başka kartın kullandığı tipler (seçicide gizlenir). */
  usedTypes: readonly RuleActionType[];
  removable: boolean;
  notificationEmail: string | null;
  onSetType: (type: RuleActionType) => void;
  onChange: (action: RuleAction) => void;
  onRemove: () => void;
}

/**
 * Aksiyon kartı: tip seçici (katalogdan), girdiler (stok: artır/ayarla + adet),
 * `danger` aksiyonlarda kart içinde uyarı satırı.
 */
export function ActionCard({ index, action, usedTypes, removable, notificationEmail, onSetType, onChange, onRemove }: ActionCardProps) {
  const def = ACTION_CATALOG[action.type];
  const typeIcon = useIconHover();
  const warning = useIconHover();
  const choices = RULE_ACTION_TYPES.filter(t => t === action.type || !usedTypes.includes(t));

  return (
    <section className={CARD} aria-label={`Aksiyon ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Aksiyon {index + 1}</Eyebrow>
        {removable && (
          <RemoveButton label={`Aksiyon ${index + 1} kaldır`} tip="Aksiyonu kaldır" onClick={onRemove} className="-mr-2 -mt-2" />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Tip ikonunun hover'ı tetikleyiciden sürülür (tetikleyici Dropdown'ın içinde). */}
        <span className="inline-flex" {...typeIcon.hoverProps}>
        <Dropdown
          label={
            <span className="inline-flex items-center gap-2">
              <ActionIcon ref={typeIcon.ref} type={action.type} tone="ink" />
              {def.label}
            </span>
          }
          active
        >
          {close =>
            choices.map(t => (
              <OptionButton
                key={t}
                label={ACTION_CATALOG[t].label}
                selected={t === action.type}
                onClick={() => {
                  if (t !== action.type) onSetType(t);
                  close();
                }}
              />
            ))
          }
        </Dropdown>
        </span>

        {action.type === 'adjust_stock' && (
          <div className="flex items-center gap-2">
            <SegmentedTrack
              size="sm"
              options={MODE_OPTIONS}
              value={action.mode}
              onChange={mode => onChange({ ...action, mode })}
              aria-label="Stok işlemi"
            />
            <NumberStepper
              size="md"
              min={1}
              max={action.mode === 'increase' ? MAX_STOCK_STEP : MAX_STOCK}
              value={action.amount}
              label={action.mode === 'increase' ? 'Artış adedi' : 'Hedef stok'}
              onChange={amount => onChange({ ...action, amount })}
            />
            <span className="text-sm text-muted-foreground">adet</span>
          </div>
        )}
      </div>

      {def.danger && (
        // `div`: animasyonlu ikon bir <div> sarmalar, <p> içinde geçersiz olurdu (hydration hatası).
        <div className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-foreground" {...warning.hoverProps}>
          <ExclamationTriangleIcon ref={warning.ref} size={14} className="mt-px flex shrink-0 text-destructive" aria-hidden />
          <span>
            <span className="font-medium">{def.danger}</span> {def.hint}
          </span>
        </div>
      )}
      {!def.danger && <p className="mt-2 text-pretty text-xs text-muted-foreground">{def.hint}</p>}
      {def.needsEmail && !notificationEmail && (
        <p className="mt-1 text-xs text-destructive">
          Önce{' '}
          <Link href="/dashboard/ayarlar#bildirim-ayarlari" className="underline underline-offset-4">
            bildirim adresi
          </Link>{' '}
          ayarlayın.
        </p>
      )}
    </section>
  );
}
