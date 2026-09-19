'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { METRIC_CATALOG, METRICS_BY_DOMAIN, STAGE_METRICS, UNIT_LABELS, type MetricInput } from '@/lib/rules/catalog';
import {
  DOMAIN_LABELS,
  LOGIC_LABELS,
  RULE_DOMAINS,
  RULE_WINDOWS,
  WINDOW_LABELS,
  type RuleCondition,
  type RuleLogic,
  type RuleMetric,
  type RuleWindowHours,
} from '@/lib/rules/types';
import { cn } from '@/lib/utils';
import { CARD, Eyebrow, RemoveButton } from './flow-primitives';

const WINDOW_OPTIONS = RULE_WINDOWS.map(h => ({ value: `${h}` as `${RuleWindowHours}`, label: WINDOW_LABELS[h] }));
const CONNECTOR_LABEL = 'font-mono text-[11px] font-medium uppercase tracking-wider';
const CONNECTOR_OPTIONS = (['and', 'or'] as const).map(value => ({
  value,
  label: <span className={CONNECTOR_LABEL}>{LOGIC_LABELS[value]}</span>,
}));
const GROUP_LABEL = 'px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

/**
 * Koşullar arasındaki bağlaç (VE ⇄ VEYA). İki seçenekli anahtar: ikisi de
 * görünür, seçili olan hapla öne çıkar — tek rozet hali tıklanamaz "SONRA"
 * rozetiyle aynı görünüyor, değiştirilebildiği anlaşılmıyordu (DESIGN.md §5
 * "Akış kartları"). VE önce bağlandığı için VEYA kümeleri ayırır (K1).
 */
export function ConnectorToggle({ op, onToggle }: { op: RuleLogic; onToggle: (op: RuleLogic) => void }) {
  return (
    <div className="flex flex-col items-center">
      <span className="h-3 w-px bg-hairline" aria-hidden />
      <Tooltip side="right" align="center">
        <TooltipTrigger asChild>
          <div>
            <SegmentedTrack
              size="sm"
              aria-label="Koşul bağlacı"
              value={op}
              onChange={next => {
                if (next !== op) onToggle(next);
              }}
              options={CONNECTOR_OPTIONS}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-balance">VE: iki koşul da sağlanmalı · VEYA: biri yeter</TooltipContent>
      </Tooltip>
      <span className="h-3 w-px bg-hairline" aria-hidden />
    </div>
  );
}

interface ConditionCardProps {
  stageIndex: number;
  index: number;
  condition: RuleCondition;
  removable: boolean;
  onSetMetric: (metric: RuleMetric) => void;
  onChange: (condition: RuleCondition) => void;
  onRemove: () => void;
}

export function ConditionCard({ stageIndex, index, condition, removable, onSetMetric, onChange, onRemove }: ConditionCardProps) {
  const def = METRIC_CATALOG[condition.metric];
  const input = def.input as MetricInput;
  const pick = (m: RuleMetric, close: () => void) => {
    if (m !== condition.metric) onSetMetric(m);
    close();
  };

  return (
    <section className={CARD} aria-label={`Koşul ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Koşul {index + 1}</Eyebrow>
        {removable && (
          <RemoveButton label={`Koşul ${index + 1} kaldır`} tip="Koşulu kaldır" onClick={onRemove} className="-mr-2 -mt-2" />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Dropdown label={def.label} active panelClassName="max-h-80 overflow-y-auto">
          {close => (
            <>
              {stageIndex > 0 && (
                <>
                  <div className={GROUP_LABEL}>Önceki aşamadan beri</div>
                  {STAGE_METRICS.map(m => (
                    <OptionButton key={m} label={METRIC_CATALOG[m].label} selected={condition.metric === m} onClick={() => pick(m, close)} />
                  ))}
                  <div aria-hidden className="-mx-1 my-1 h-px bg-border" />
                </>
              )}
              {RULE_DOMAINS.map(domain => (
                <div key={domain}>
                  <div className={GROUP_LABEL}>{DOMAIN_LABELS[domain]}</div>
                  {METRICS_BY_DOMAIN[domain].map(m => (
                    <OptionButton key={m} label={METRIC_CATALOG[m].label} selected={condition.metric === m} onClick={() => pick(m, close)} />
                  ))}
                </div>
              ))}
            </>
          )}
        </Dropdown>

        {input.kind === 'number' && 'threshold' in condition && (
          <div className="flex items-center gap-2">
            <NumberStepper
              size="md"
              min={input.min}
              max={'thresholdUnit' in condition && condition.thresholdUnit === 'percent' ? 100 : input.max}
              value={condition.threshold}
              label="Eşik"
              onChange={threshold => onChange({ ...condition, threshold })}
            />
            {condition.metric === 'stock_drop' ? (
              <SegmentedTrack
                size="sm"
                options={[
                  { value: 'units', label: 'adet' },
                  { value: 'percent', label: '%' },
                ]}
                value={condition.thresholdUnit}
                onChange={u => onChange({ ...condition, thresholdUnit: u })}
                aria-label="Eşik birimi"
              />
            ) : (
              <span className="text-sm text-muted-foreground">{UNIT_LABELS[input.units[0]]}</span>
            )}
          </div>
        )}

        {input.kind === 'enum' && 'value' in condition && (
          <Dropdown label={input.options.find(o => o.value === condition.value)?.label ?? condition.value} active>
            {close =>
              input.options.map(o => (
                <OptionButton
                  key={o.value}
                  label={o.label}
                  selected={condition.value === o.value}
                  onClick={() => {
                    onChange({ ...condition, value: o.value } as RuleCondition);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>
        )}
      </div>

      {def.window === 'measure' && 'windowHours' in condition && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted-foreground">Zaman penceresi</p>
          <SegmentedTrack
            size="sm"
            options={WINDOW_OPTIONS}
            value={`${condition.windowHours}` as `${RuleWindowHours}`}
            onChange={v => onChange({ ...condition, windowHours: Number(v) as RuleWindowHours })}
            aria-label="Zaman penceresi"
          />
        </div>
      )}

      <p className={cn('mt-2 text-pretty text-xs', def.stageOnly && stageIndex === 0 ? 'text-destructive' : 'text-muted-foreground')}>
        {def.stageOnly && stageIndex === 0 ? 'Bu koşul yalnız 2. aşamadan itibaren kullanılabilir.' : def.hint}
      </p>
    </section>
  );
}
