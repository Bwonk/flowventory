'use client';

import { Input } from '@/components/ui/input';
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
const GROUP_LABEL = 'px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

/**
 * Koşullar arasındaki tıklanabilir bağlaç rozeti (VE ⇄ VEYA). Badge
 * görünümlü buton; VE önce bağlandığı için VEYA kümeleri ayırır (K1).
 */
export function ConnectorToggle({ op, onToggle }: { op: RuleLogic; onToggle: (op: RuleLogic) => void }) {
  const next: RuleLogic = op === 'and' ? 'or' : 'and';
  return (
    <div className="flex flex-col items-center">
      <span className="h-3 w-px bg-hairline" aria-hidden />
      <button
        type="button"
        onClick={() => onToggle(next)}
        aria-label={`Bağlaç ${LOGIC_LABELS[op]} — ${LOGIC_LABELS[next]} yapmak için tıklayın`}
        className="inline-flex h-6 items-center rounded-md border border-hairline bg-card px-2 font-mono text-[11px] font-medium uppercase tracking-wider text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {LOGIC_LABELS[op]}
      </button>
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
            <Input
              type="number"
              min={input.min}
              max={'thresholdUnit' in condition && condition.thresholdUnit === 'percent' ? 100 : input.max}
              value={condition.threshold}
              aria-label="Eşik"
              onChange={e => onChange({ ...condition, threshold: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="w-24 tabular-nums"
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
