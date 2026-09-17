'use client';

import { Fragment } from 'react';
import { describeRule } from '@/lib/rules/describe';
import { MAX_STAGES } from '@/lib/rules/types';
import type { TargetOption } from '../TargetPicker';
import { DashedAddButton, Eyebrow, FlowConnector } from './flow-primitives';
import { RunSettings } from './RunSettings';
import { StageBlock } from './StageBlock';
import { TriggerCard } from './TriggerCard';
import type { useRuleBuilder } from './use-rule-builder';

interface FlowCanvasProps {
  builder: ReturnType<typeof useRuleBuilder>;
  products: TargetOption[];
  vendors: TargetOption[];
  optionsLoading: boolean;
  notificationEmail: string | null;
}

/**
 * Tek kolon akış kanvası (DESIGN.md §5 "Akış kartları"): tetikleyici →
 * aşamalar ("SONRA" ile bağlı) → "+ Aşama ekle" → çalışma ayarları → önizleme.
 */
export function FlowCanvas({ builder, products, vendors, optionsLoading, notificationEmail }: FlowCanvasProps) {
  const { state } = builder;
  const stages = state.workflow.stages;

  return (
    <div className="flex flex-col items-stretch">
      <TriggerCard
        state={state}
        hasStockAction={builder.hasStockAction}
        products={products}
        vendors={vendors}
        optionsLoading={optionsLoading}
        onScopeChange={builder.setScope}
        onPatch={builder.patch}
      />

      {stages.map((stage, si) => (
        <Fragment key={si}>
          <FlowConnector label={si > 0 ? 'Sonra' : undefined} />
          <StageBlock
            stage={stage}
            stageIndex={si}
            stageCount={stages.length}
            notificationEmail={notificationEmail}
            onAddCondition={() => builder.addCondition(si)}
            onSetMetric={(i, m) => builder.setMetric(si, i, m)}
            onUpdateCondition={(i, c) => builder.updateCondition(si, i, c)}
            onSetConnector={(i, op) => builder.setConnector(si, i, op)}
            onRemoveCondition={i => builder.removeCondition(si, i)}
            onAddAction={t => builder.addAction(si, t)}
            onSetActionType={(i, t) => builder.setActionType(si, i, t)}
            onUpdateAction={(i, a) => builder.updateAction(si, i, a)}
            onRemoveAction={i => builder.removeAction(si, i)}
            onRemoveStage={() => builder.removeStage(si)}
          />
        </Fragment>
      ))}

      <FlowConnector />
      <DashedAddButton
        label={stages.length < MAX_STAGES ? 'Aşama ekle — önceki aşamadan sonra çalışır' : `En fazla ${MAX_STAGES} aşama`}
        disabled={stages.length >= MAX_STAGES}
        onClick={builder.addStage}
      />

      <div className="mt-6 flex flex-col gap-3">
        <RunSettings state={state} hasStockAction={builder.hasStockAction} onPatch={builder.patch} />
        <section aria-label="Önizleme" className="rounded-lg border border-hairline px-4 py-3">
          <Eyebrow>Önizleme</Eyebrow>
          <p className="mt-1 text-pretty text-sm text-foreground">{describeRule(state)}</p>
        </section>
      </div>
    </div>
  );
}
