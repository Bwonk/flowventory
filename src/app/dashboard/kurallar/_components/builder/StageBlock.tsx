'use client';

import { AnimatePresence, motion } from 'motion/react';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import { GooMenuItem } from '@/components/motion/goo-popover/menu';
import { ACTION_CATALOG } from '@/lib/rules/actions-catalog';
import { groupNodes } from '@/lib/rules/logic';
import {
  MAX_ACTIONS,
  MAX_CONDITIONS,
  RULE_ACTION_TYPES,
  type RuleAction,
  type RuleActionType,
  type RuleCondition,
  type RuleLogic,
  type RuleMetric,
} from '@/lib/rules/types';
import { PRESS_FEEDBACK_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ActionIcon } from '../ActionIcon';
import { ActionCard } from './ActionCard';
import { ConditionCard, ConnectorToggle } from './ConditionCard';
import { DASHED_ADD, DashedAddButton, Eyebrow, FlowConnector, REMOVE_HIGHLIGHT_STAGE, RemoveButton, useFlowItemMotion } from './flow-primitives';
import type { BuilderStage } from './stage-ops';

export interface StageHandlers {
  onAddCondition: () => void;
  onSetMetric: (index: number, metric: RuleMetric) => void;
  onUpdateCondition: (index: number, condition: RuleCondition) => void;
  onSetConnector: (index: number, op: RuleLogic) => void;
  onRemoveCondition: (index: number) => void;
  onAddAction: (type: RuleActionType) => void;
  onSetActionType: (index: number, type: RuleActionType) => void;
  onUpdateAction: (index: number, action: RuleAction) => void;
  onRemoveAction: (index: number) => void;
  onRemoveStage: () => void;
}

interface StageBlockProps extends StageHandlers {
  stage: BuilderStage;
  stageIndex: number;
  stageCount: number;
  notificationEmail: string | null;
}

/**
 * Aşama: koşul kartları (VE zincirleri ince çerçeveli küme, kümeler arası
 * VEYA) → aksiyon kartları. Tek aşamalı kuralda başlık gizli.
 */
export function StageBlock({ stage, stageIndex, stageCount, notificationEmail, ...h }: StageBlockProps) {
  const motionProps = useFlowItemMotion();
  const groups = groupNodes(stage.conditions);
  const clustered = groups.length > 1 || stage.conditions.length > 1;
  const usedTypes = stage.actions.map(a => a.type);
  const addableTypes = RULE_ACTION_TYPES.filter(t => !usedTypes.includes(t));
  const canAddAction = stage.actions.length < MAX_ACTIONS && addableTypes.length > 0;

  const plus = useIconHover();

  return (
    <section aria-label={`Aşama ${stageIndex + 1}`} className="group/stage flex flex-col">
      {stageCount > 1 && (
        // `px-px`: kartların 1px kenarlığı kadar — çöp ikonu alttaki kartlardakiyle aynı dikey hizada.
        <div className="mb-2 flex items-center justify-between gap-3 px-px">
          <Eyebrow>Aşama {stageIndex + 1}</Eyebrow>
          {stageIndex > 0 && (
            <RemoveButton
              label={`Aşama ${stageIndex + 1} kaldır`}
              tip="Aşamayı kaldır — koşulları ve aksiyonlarıyla birlikte"
              scope="stage"
              onClick={h.onRemoveStage}
              className="-my-1 mr-2"
            />
          )}
        </div>
      )}

      {/* Koşullar — VE kümeleri. İlk küme hep aynı anahtarda (ilk koşul kaldırılınca
          küme yeniden kurulmasın); sonrakiler kendilerini başlatan VEYA düğümüyle. */}
      <AnimatePresence initial={false}>
        {groups.map((group, gi) => (
          <motion.div key={gi === 0 ? 'first' : stage.conditions[group[0]].key} {...motionProps} className="flex flex-col">
            {gi > 0 && <ConnectorToggle op="or" onToggle={op => h.onSetConnector(group[0], op)} />}
            <div className={cn('flex flex-col', clustered && group.length > 1 && cn('rounded-lg border border-hairline p-2', REMOVE_HIGHLIGHT_STAGE))}>
              <AnimatePresence initial={false}>
                {group.map((index, pos) => (
                  <motion.div key={stage.conditions[index].key} {...motionProps} className="flex flex-col">
                    {pos > 0 && <ConnectorToggle op="and" onToggle={op => h.onSetConnector(index, op)} />}
                    <ConditionCard
                      stageIndex={stageIndex}
                      index={index}
                      condition={stage.conditions[index].condition}
                      removable={stage.conditions.length > 1}
                      onSetMetric={m => h.onSetMetric(index, m)}
                      onChange={c => h.onUpdateCondition(index, c)}
                      onRemove={() => h.onRemoveCondition(index)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <FlowConnector />
      <DashedAddButton
        label={stage.conditions.length < MAX_CONDITIONS ? 'Koşul ekle' : `En fazla ${MAX_CONDITIONS} koşul`}
        disabled={stage.conditions.length >= MAX_CONDITIONS}
        onClick={h.onAddCondition}
      />

      <FlowConnector label="→" />

      {/* Aksiyonlar */}
      <AnimatePresence initial={false}>
        {stage.actions.map((action, index) => (
          <motion.div key={action.key} {...motionProps} className="flex flex-col">
            {index > 0 && <FlowConnector />}
            <ActionCard
              index={index}
              action={action}
              usedTypes={usedTypes}
              removable={stage.actions.length > 1}
              notificationEmail={notificationEmail}
              onSetType={t => h.onSetActionType(index, t)}
              onChange={a => h.onUpdateAction(index, a)}
              onRemove={() => h.onRemoveAction(index)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <FlowConnector />
      {/* Kesikli kart `rounded-lg`: oyuk yarıçapı 8. Tam genişlikte tetikleyicide morph ortadan başlar. */}
      <GooPopover align="center" dismiss="consume" triggerRadius={8} className="flex w-full">
        <GooPopoverTrigger>
          <button type="button" className={cn(DASHED_ADD, PRESS_FEEDBACK_CLASS)} disabled={!canAddAction} {...plus.hoverProps}>
            <PlusIcon ref={plus.ref} size={14} className="flex shrink-0" aria-hidden />
            {canAddAction ? 'Aksiyon ekle' : 'Tüm aksiyonlar eklendi'}
          </button>
        </GooPopoverTrigger>
        <GooPopoverContent aria-label="Aksiyon ekle" className="min-w-[220px] p-1.5">
          {addableTypes.map(t => (
            <AddActionItem key={t} type={t} onSelect={() => h.onAddAction(t)} />
          ))}
        </GooPopoverContent>
      </GooPopover>
    </section>
  );
}

/** "Aksiyon ekle" menü öğesi — ikon hover'ı öğeden sürülür. */
function AddActionItem({ type, onSelect }: { type: RuleActionType; onSelect: () => void }) {
  const icon = useIconHover();
  return (
    <GooMenuItem onSelect={onSelect} {...icon.hoverProps}>
      <ActionIcon ref={icon.ref} type={type} tone="ink" />
      {ACTION_CATALOG[type].label}
    </GooMenuItem>
  );
}
