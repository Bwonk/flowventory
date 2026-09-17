'use client';

import { useCallback, useMemo, useReducer } from 'react';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { defaultCondition, METRICS_BY_DOMAIN } from '@/lib/rules/catalog';
import { ruleInputSchema, type RuleInput } from '@/lib/rules/schema';
import {
  MAX_CONDITIONS,
  type RuleChannel,
  type RuleCondition,
  type RuleDomain,
  type RuleLogic,
  type RuleMetric,
  type RuleScope,
  type RuleWindowHours,
} from '@/lib/rules/types';

export interface BuilderState {
  name: string;
  scope: RuleScope;
  targetId: string | null;
  targetLabel: string | null;
  domain: RuleDomain;
  channel: RuleChannel;
  logic: RuleLogic;
  cooldownHours: RuleWindowHours;
  conditions: RuleCondition[];
  enabled: boolean;
}

type Action =
  | { type: 'patch'; patch: Partial<BuilderState> }
  | { type: 'setScope'; scope: RuleScope }
  | { type: 'addCondition'; condition: RuleCondition }
  | { type: 'updateCondition'; index: number; condition: RuleCondition }
  | { type: 'removeCondition'; index: number };

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'setScope':
      return { ...state, scope: action.scope, targetId: null, targetLabel: null };
    case 'addCondition':
      if (state.conditions.length >= MAX_CONDITIONS) return state;
      return { ...state, conditions: [...state.conditions, action.condition] };
    case 'updateCondition':
      return { ...state, conditions: state.conditions.map((c, i) => (i === action.index ? action.condition : c)) };
    case 'removeCondition':
      return { ...state, conditions: state.conditions.filter((_, i) => i !== action.index) };
  }
}

export interface BuilderInit {
  rule: TrackingRuleItem | null;
  channel: RuleChannel;
  domain: RuleDomain;
  leadTimeDays: number;
}

function initialState({ rule, channel, domain, leadTimeDays }: BuilderInit): BuilderState {
  if (rule) {
    return {
      name: rule.name,
      scope: rule.scope,
      targetId: rule.targetId,
      targetLabel: rule.targetLabel,
      domain: rule.domain,
      channel: rule.channel,
      logic: rule.logic,
      cooldownHours: rule.cooldownHours,
      conditions: rule.conditions,
      enabled: rule.enabled,
    };
  }
  const firstMetric = METRICS_BY_DOMAIN[domain][0];
  return {
    name: '',
    scope: 'all',
    targetId: null,
    targetLabel: null,
    domain,
    channel,
    logic: 'and',
    cooldownHours: 24,
    conditions: [defaultCondition(firstMetric, { leadTimeDays })],
    enabled: true,
  };
}

/**
 * Oluşturucu state'i — koşul listesi + meta. `toInput` zod ile doğrular;
 * ilk hata mesajı `issue` olarak döner (aria-live alanına yazılır).
 */
export function useRuleBuilder(init: BuilderInit) {
  const [state, dispatch] = useReducer(reducer, init, initialState);
  const leadTimeDays = init.leadTimeDays;

  const patch = useCallback((p: Partial<BuilderState>) => dispatch({ type: 'patch', patch: p }), []);
  const setScope = useCallback((scope: RuleScope) => dispatch({ type: 'setScope', scope }), []);
  const addCondition = useCallback(
    (metric?: RuleMetric) => {
      const m = metric ?? METRICS_BY_DOMAIN[state.domain][0];
      dispatch({ type: 'addCondition', condition: defaultCondition(m, { leadTimeDays }) });
    },
    [state.domain, leadTimeDays],
  );
  const updateCondition = useCallback((index: number, condition: RuleCondition) => dispatch({ type: 'updateCondition', index, condition }), []);
  const setMetric = useCallback(
    (index: number, metric: RuleMetric) => dispatch({ type: 'updateCondition', index, condition: defaultCondition(metric, { leadTimeDays }) }),
    [leadTimeDays],
  );
  const removeCondition = useCallback((index: number) => dispatch({ type: 'removeCondition', index }), []);

  const availableMetrics = useMemo(() => METRICS_BY_DOMAIN[state.domain], [state.domain]);

  const toInput = useCallback((): { input: RuleInput; issue: null } | { input: null; issue: string } => {
    const parsed = ruleInputSchema.safeParse(state);
    if (parsed.success) return { input: parsed.data, issue: null };
    return { input: null, issue: parsed.error.issues[0]?.message ?? 'Formu kontrol edin' };
  }, [state]);

  return { state, patch, setScope, addCondition, updateCondition, setMetric, removeCondition, availableMetrics, toInput };
}
