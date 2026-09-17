'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell, Mail, Plus, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { METRIC_CATALOG, UNIT_LABELS, type MetricInput } from '@/lib/rules/catalog';
import { describeOutcome, describeRule, describeScope } from '@/lib/rules/describe';
import {
  CHANNEL_LABELS,
  LOGIC_LABELS,
  MAX_CONDITIONS,
  RULE_WINDOWS,
  WINDOW_LABELS,
  type RuleCondition,
  type RuleLogic,
  type RuleMetric,
  type RuleWindowHours,
} from '@/lib/rules/types';
import { cn } from '@/lib/utils';
import type { BuilderState } from './use-rule-builder';

/**
 * Akış kanvası (DESIGN.md §5 "Akış kartları"): tetikleyici → bağlaç →
 * koşul kartları → sonuç. Sürükleme yok; sıra ekleme sırasıdır. Kartlar
 * hairline, aralarında dikey bağlantı çizgisi ve bağlaç rozeti.
 */

const CARD = 'rounded-lg border border-hairline bg-card p-4';

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function FlowConnector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="h-4 w-px bg-hairline" />
      {label && (
        <>
          <Badge variant="outline" className="font-mono uppercase tracking-wider">
            {label}
          </Badge>
          <span className="h-4 w-px bg-hairline" />
        </>
      )}
    </div>
  );
}

const WINDOW_OPTIONS = RULE_WINDOWS.map(h => ({ value: `${h}` as `${RuleWindowHours}`, label: WINDOW_LABELS[h] }));
const LOGIC_OPTIONS: ReadonlyArray<{ value: RuleLogic; label: string }> = [
  { value: 'and', label: LOGIC_LABELS.and },
  { value: 'or', label: LOGIC_LABELS.or },
];

interface FlowCanvasProps {
  state: BuilderState;
  availableMetrics: readonly RuleMetric[];
  productCountHint?: string;
  onLogicChange: (logic: RuleLogic) => void;
  onAddCondition: () => void;
  onSetMetric: (index: number, metric: RuleMetric) => void;
  onUpdateCondition: (index: number, condition: RuleCondition) => void;
  onRemoveCondition: (index: number) => void;
}

export function FlowCanvas({
  state,
  availableMetrics,
  productCountHint,
  onLogicChange,
  onAddCondition,
  onSetMetric,
  onUpdateCondition,
  onRemoveCondition,
}: FlowCanvasProps) {
  const reduceMotion = useReducedMotion();
  const connectorLabel = state.logic === 'and' ? 'VE' : 'VEYA';
  const canAdd = state.conditions.length < MAX_CONDITIONS;

  return (
    <div className="flex flex-col items-stretch">
      {/* Tetikleyici */}
      <section className={CARD} aria-label="Tetikleyici">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-muted-foreground" aria-hidden />
          <Eyebrow>Tetikleyici</Eyebrow>
        </div>
        <p className="mt-1 text-sm text-foreground">{describeScope(state)}</p>
        {productCountHint && <p className="mt-0.5 text-xs text-muted-foreground">{productCountHint}</p>}
      </section>

      <FlowConnector />

      {/* Bağlaç */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
        <Eyebrow>Koşullar</Eyebrow>
        <SegmentedTrack
          size="sm"
          options={LOGIC_OPTIONS}
          value={state.logic}
          onChange={onLogicChange}
          aria-label="Koşul bağlacı"
          className={cn(state.conditions.length < 2 && 'pointer-events-none opacity-50')}
        />
      </div>

      <FlowConnector />

      {/* Koşul kartları */}
      <AnimatePresence initial={false}>
        {state.conditions.map((condition, index) => (
          <motion.div
            key={`${index}`}
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col"
          >
            {index > 0 && <FlowConnector label={connectorLabel} />}
            <ConditionCard
              index={index}
              condition={condition}
              availableMetrics={availableMetrics}
              removable={state.conditions.length > 1}
              onSetMetric={m => onSetMetric(index, m)}
              onChange={c => onUpdateCondition(index, c)}
              onRemove={() => onRemoveCondition(index)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <FlowConnector />

      <button
        type="button"
        onClick={onAddCondition}
        disabled={!canAdd}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-hairline px-4 py-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden />
        {canAdd ? 'Koşul ekle' : `En fazla ${MAX_CONDITIONS} koşul`}
      </button>

      <FlowConnector label="→" />

      {/* Sonuç */}
      <section className={CARD} aria-label="Sonuç">
        <div className="flex items-center gap-2">
          {state.channel === 'email' ? (
            <Mail className="size-4 text-muted-foreground" aria-hidden />
          ) : (
            <Bell className="size-4 text-muted-foreground" aria-hidden />
          )}
          <Eyebrow>Sonuç · {CHANNEL_LABELS[state.channel]}</Eyebrow>
        </div>
        <p className="mt-1 text-sm text-foreground">{describeOutcome(state)}</p>
        <div className="mt-3 rounded-md bg-muted px-3 py-2">
          <Eyebrow>Önizleme</Eyebrow>
          <p className="mt-0.5 text-pretty text-sm text-foreground">{describeRule(state)}</p>
        </div>
      </section>
    </div>
  );
}

interface ConditionCardProps {
  index: number;
  condition: RuleCondition;
  availableMetrics: readonly RuleMetric[];
  removable: boolean;
  onSetMetric: (metric: RuleMetric) => void;
  onChange: (condition: RuleCondition) => void;
  onRemove: () => void;
}

function ConditionCard({ index, condition, availableMetrics, removable, onSetMetric, onChange, onRemove }: ConditionCardProps) {
  const def = METRIC_CATALOG[condition.metric];
  const input = def.input as MetricInput;

  return (
    <section className={CARD} aria-label={`Koşul ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Koşul {index + 1}</Eyebrow>
        {removable && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 size-7 text-muted-foreground hover:text-destructive"
            aria-label={`Koşul ${index + 1} kaldır`}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Dropdown label={def.label} active>
          {close =>
            availableMetrics.map(m => (
              <OptionButton
                key={m}
                label={METRIC_CATALOG[m].label}
                selected={condition.metric === m}
                onClick={() => {
                  if (m !== condition.metric) onSetMetric(m);
                  close();
                }}
              />
            ))
          }
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

      <p className="mt-2 text-pretty text-xs text-muted-foreground">{def.hint}</p>
    </section>
  );
}
