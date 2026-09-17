'use client';

import { useCallback, useReducer } from 'react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { defaultAction, hasActionType } from '@/lib/rules/actions-catalog';
import { defaultCondition } from '@/lib/rules/catalog';
import { ruleInputSchema, type RuleInput } from '@/lib/rules/schema';
import type { RuleTemplate } from '@/lib/rules/templates';
import {
  MAX_ACTIONS,
  MAX_CONDITIONS,
  MAX_STAGES,
  type RuleAction,
  type RuleActionType,
  type RuleCondition,
  type RuleGranularity,
  type RuleLogic,
  type RuleMetric,
  type RuleScope,
  type RuleStage,
  type RuleWindowHours,
  type RuleWorkflow,
} from '@/lib/rules/types';

export interface BuilderState {
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  granularity: RuleGranularity;
  workflow: RuleWorkflow;
  cooldownHours: RuleWindowHours;
  resetHours: RuleWindowHours;
  maxRunsPerDay: number;
  enabled: boolean;
}

type Action =
  | { type: 'patch'; patch: Partial<BuilderState> }
  | { type: 'setScope'; scope: RuleScope }
  | { type: 'addStage'; stage: RuleStage }
  | { type: 'removeStage'; stage: number }
  | { type: 'addCondition'; stage: number; condition: RuleCondition }
  | { type: 'updateCondition'; stage: number; index: number; condition: RuleCondition }
  | { type: 'setConnector'; stage: number; index: number; op: RuleLogic }
  | { type: 'removeCondition'; stage: number; index: number }
  | { type: 'addAction'; stage: number; action: RuleAction }
  | { type: 'updateAction'; stage: number; index: number; action: RuleAction }
  | { type: 'removeAction'; stage: number; index: number };

function mapStage(state: BuilderState, stageIndex: number, fn: (stage: RuleStage) => RuleStage): BuilderState {
  return {
    ...state,
    workflow: { stages: state.workflow.stages.map((s, i) => (i === stageIndex ? fn(s) : s)) },
  };
}

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'setScope':
      return { ...state, scope: action.scope, targetId: null, targetLabel: null };
    case 'addStage':
      if (state.workflow.stages.length >= MAX_STAGES) return state;
      return { ...state, workflow: { stages: [...state.workflow.stages, action.stage] } };
    case 'removeStage':
      // Aşama 1 silinmez; sonraki aşamalar "önceki aşamaya" göre ölçer.
      if (action.stage === 0) return state;
      return { ...state, workflow: { stages: state.workflow.stages.filter((_, i) => i !== action.stage) } };
    case 'addCondition':
      return mapStage(state, action.stage, s =>
        s.conditions.length >= MAX_CONDITIONS ? s : { ...s, conditions: [...s.conditions, { op: 'and', condition: action.condition }] },
      );
    case 'updateCondition':
      return mapStage(state, action.stage, s => ({
        ...s,
        conditions: s.conditions.map((n, i) => (i === action.index ? { ...n, condition: action.condition } : n)),
      }));
    case 'setConnector':
      return mapStage(state, action.stage, s => ({
        ...s,
        conditions: s.conditions.map((n, i) => (i === action.index ? { ...n, op: action.op } : n)),
      }));
    case 'removeCondition':
      return mapStage(state, action.stage, s => ({ ...s, conditions: s.conditions.filter((_, i) => i !== action.index) }));
    case 'addAction':
      return mapStage(state, action.stage, s =>
        s.actions.length >= MAX_ACTIONS || s.actions.some(a => a.type === action.action.type)
          ? s
          : { ...s, actions: [...s.actions, action.action] },
      );
    case 'updateAction':
      return mapStage(state, action.stage, s => ({
        ...s,
        actions: s.actions.map((a, i) => (i === action.index ? action.action : a)),
      }));
    case 'removeAction':
      return mapStage(state, action.stage, s => ({ ...s, actions: s.actions.filter((_, i) => i !== action.index) }));
  }
}

export interface BuilderInit {
  rule: TrackingRuleItem | null;
  template: RuleTemplate | null;
  leadTimeDays: number;
}

function initialState({ rule, template, leadTimeDays }: BuilderInit): BuilderState {
  if (rule) {
    return {
      name: rule.name,
      scope: rule.scope,
      targetId: rule.targetId,
      targetLabel: rule.targetLabel,
      granularity: rule.granularity,
      workflow: rule.workflow,
      cooldownHours: rule.cooldownHours,
      resetHours: rule.resetHours,
      maxRunsPerDay: rule.maxRunsPerDay,
      enabled: rule.enabled,
    };
  }
  const base = { scope: 'all' as const, targetId: null, targetLabel: null, enabled: true };
  if (template) return { ...base, ...template.rule };
  return {
    ...base,
    name: '',
    granularity: 'product',
    cooldownHours: 24,
    resetHours: 168,
    maxRunsPerDay: 1,
    workflow: {
      stages: [
        {
          conditions: [{ op: 'and', condition: defaultCondition('stock_below', { leadTimeDays }) }],
          actions: [defaultAction('notify')],
        },
      ],
    },
  };
}

export type ToInputResult = { input: RuleInput; issue: null } | { input: null; issue: string };

/**
 * Oluşturucu state'i — aşamalar, koşul düğümleri, aksiyonlar + meta.
 * `toInput` zod ile doğrular; ilk hata mesajı `issue` olarak döner.
 * Stok aksiyonu varsa değerlendirme birimi zorunlu olarak varyanttır (K4).
 */
export function useRuleBuilder(init: BuilderInit) {
  const [state, dispatch] = useReducer(reducer, init, initialState);
  const leadTimeDays = init.leadTimeDays;

  const patch = useCallback((p: Partial<BuilderState>) => dispatch({ type: 'patch', patch: p }), []);
  const setScope = useCallback((scope: RuleScope) => dispatch({ type: 'setScope', scope }), []);

  const addStage = useCallback(
    () =>
      dispatch({
        type: 'addStage',
        stage: {
          conditions: [{ op: 'and', condition: defaultCondition('stock_drop_since_stage', { leadTimeDays }) }],
          actions: [defaultAction('email')],
        },
      }),
    [leadTimeDays],
  );
  const removeStage = useCallback((stage: number) => dispatch({ type: 'removeStage', stage }), []);

  const addCondition = useCallback(
    (stage: number) => dispatch({ type: 'addCondition', stage, condition: defaultCondition('stock_below', { leadTimeDays }) }),
    [leadTimeDays],
  );
  const setMetric = useCallback(
    (stage: number, index: number, metric: RuleMetric) =>
      dispatch({ type: 'updateCondition', stage, index, condition: defaultCondition(metric, { leadTimeDays }) }),
    [leadTimeDays],
  );
  const updateCondition = useCallback(
    (stage: number, index: number, condition: RuleCondition) => dispatch({ type: 'updateCondition', stage, index, condition }),
    [],
  );
  const setConnector = useCallback((stage: number, index: number, op: RuleLogic) => dispatch({ type: 'setConnector', stage, index, op }), []);
  const removeCondition = useCallback((stage: number, index: number) => dispatch({ type: 'removeCondition', stage, index }), []);

  const addAction = useCallback((stage: number, type: RuleActionType) => dispatch({ type: 'addAction', stage, action: defaultAction(type) }), []);
  const setActionType = useCallback(
    (stage: number, index: number, type: RuleActionType) => dispatch({ type: 'updateAction', stage, index, action: defaultAction(type) }),
    [],
  );
  const updateAction = useCallback((stage: number, index: number, action: RuleAction) => dispatch({ type: 'updateAction', stage, index, action }), []);
  const removeAction = useCallback((stage: number, index: number) => dispatch({ type: 'removeAction', stage, index }), []);

  const hasStockAction = hasActionType(state.workflow, 'adjust_stock');

  const toInput = useCallback(
    (stockWriteConsent: boolean): ToInputResult => {
      const parsed = ruleInputSchema.safeParse({
        ...state,
        granularity: hasActionType(state.workflow, 'adjust_stock') ? 'variant' : state.granularity,
        stockWriteConsent,
      });
      if (parsed.success) return { input: parsed.data, issue: null };
      return { input: null, issue: parsed.error.issues[0]?.message ?? 'Formu kontrol edin' };
    },
    [state],
  );

  return {
    state,
    hasStockAction,
    patch,
    setScope,
    addStage,
    removeStage,
    addCondition,
    setMetric,
    updateCondition,
    setConnector,
    removeCondition,
    addAction,
    setActionType,
    updateAction,
    removeAction,
    toInput,
  };
}
