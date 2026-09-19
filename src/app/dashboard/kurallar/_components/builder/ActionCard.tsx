'use client';

import Link from 'next/link';
import { TriangleAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { ACTION_CATALOG, STOCK_MODE_LABELS } from '@/lib/rules/actions-catalog';
import { MAX_STOCK, MAX_STOCK_STEP, RULE_ACTION_TYPES, STOCK_ADJUST_MODES, type RuleAction, type RuleActionType } from '@/lib/rules/types';
import { ActionIcon } from '../ActionIcon';
import { CARD, Eyebrow } from './flow-primitives';

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
  const choices = RULE_ACTION_TYPES.filter(t => t === action.type || !usedTypes.includes(t));

  return (
    <section className={CARD} aria-label={`Aksiyon ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Aksiyon {index + 1}</Eyebrow>
        {removable && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 size-7 text-muted-foreground hover:text-destructive"
            aria-label={`Aksiyon ${index + 1} kaldır`}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Dropdown
          goo
          label={
            <span className="inline-flex items-center gap-2">
              <ActionIcon type={action.type} className="text-foreground" />
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

        {action.type === 'adjust_stock' && (
          <div className="flex items-center gap-2">
            <SegmentedTrack
              size="sm"
              options={MODE_OPTIONS}
              value={action.mode}
              onChange={mode => onChange({ ...action, mode })}
              aria-label="Stok işlemi"
            />
            <Input
              type="number"
              min={1}
              max={action.mode === 'increase' ? MAX_STOCK_STEP : MAX_STOCK}
              value={action.amount}
              aria-label={action.mode === 'increase' ? 'Artış adedi' : 'Hedef stok'}
              onChange={e => onChange({ ...action, amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">adet</span>
          </div>
        )}
      </div>

      {def.danger && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
          <span>
            <span className="font-medium">{def.danger}</span> {def.hint}
          </span>
        </p>
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
