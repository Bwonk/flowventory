'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { describeCadence } from '@/lib/rules/describe';
import { MAX_RUNS_PER_DAY_LIMIT, RULE_WINDOWS, WINDOW_LABELS, type RuleWindowHours } from '@/lib/rules/types';
import type { BuilderState } from './use-rule-builder';

const WINDOW_OPTIONS = RULE_WINDOWS.map(h => ({ value: `${h}` as `${RuleWindowHours}`, label: WINDOW_LABELS[h] }));

function Setting({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface RunSettingsProps {
  state: BuilderState;
  hasStockAction: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
}

/** Kanvas altındaki "Çalışma ayarları": aralık, (çok aşamada) sıfırlanma, (stokta) günlük sınır. */
export function RunSettings({ state, hasStockAction, onPatch }: RunSettingsProps) {
  const multiStage = state.workflow.stages.length > 1;
  const granularity = hasStockAction ? 'variant' : state.granularity;

  return (
    <section aria-label="Çalışma ayarları" className="flex flex-col gap-4 rounded-lg bg-muted px-4 py-3">
      <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Çalışma ayarları</p>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Setting label="Yeniden çalışma aralığı" hint={`Her aşama ${describeCadence({ cooldownHours: state.cooldownHours, granularity })}.`}>
          <SegmentedTrack
            size="sm"
            options={WINDOW_OPTIONS}
            value={`${state.cooldownHours}` as `${RuleWindowHours}`}
            onChange={v => onPatch({ cooldownHours: Number(v) as RuleWindowHours })}
            aria-label="Yeniden çalışma aralığı"
          />
        </Setting>
        {multiStage && (
          <Setting label="Aşamalar sıfırlanır" hint="Bu süre dolunca ya da aşama 1 koşulu bozulunca akış başa döner.">
            <SegmentedTrack
              size="sm"
              options={WINDOW_OPTIONS}
              value={`${state.resetHours}` as `${RuleWindowHours}`}
              onChange={v => onPatch({ resetHours: Number(v) as RuleWindowHours })}
              aria-label="Aşama sıfırlanma süresi"
            />
          </Setting>
        )}
        {hasStockAction && (
          <Setting label="Günlük stok yazımı üst sınırı" hint="Varyant başına, son 24 saatte.">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={MAX_RUNS_PER_DAY_LIMIT}
                value={state.maxRunsPerDay}
                aria-label="Günlük stok yazımı üst sınırı"
                onChange={e => onPatch({ maxRunsPerDay: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                className="h-8 w-20 bg-card tabular-nums"
              />
              <span className="text-sm text-muted-foreground">kez / gün</span>
            </div>
          </Setting>
        )}
      </div>
    </section>
  );
}
