import type { RuleGranularity, RuleWindowHours, RuleWorkflow } from './types';

/**
 * Hazır kural şablonları — istemcide saf sabit. Oluşturucu şablonu taslak
 * olarak açar; kapsam her zaman "Tüm ürünler" başlar.
 */

export type RuleTemplateKey = 'low-stock-notify' | 'fast-drain-escalate' | 'auto-restock';

export interface RuleTemplate {
  key: RuleTemplateKey;
  name: string;
  /** Menüde tek satır açıklama. */
  description: string;
  rule: {
    name: string;
    granularity: RuleGranularity;
    workflow: RuleWorkflow;
    cooldownHours: RuleWindowHours;
    resetHours: RuleWindowHours;
    maxRunsPerDay: number;
  };
}

export const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    key: 'low-stock-notify',
    name: 'Stok azalınca haber ver',
    description: 'Stok 10 adedin altına inince zilde bildirim.',
    rule: {
      name: 'Stok azalınca haber ver',
      granularity: 'product',
      cooldownHours: 24,
      resetHours: 168,
      maxRunsPerDay: 1,
      workflow: {
        stages: [{ conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 10 } }], actions: [{ type: 'notify' }] }],
      },
    },
  },
  {
    key: 'fast-drain-escalate',
    name: 'Hızlı eriyen ürün',
    description: 'Önce bildirim; 3 adet daha düşerse e-posta.',
    rule: {
      name: 'Hızlı eriyen ürün',
      granularity: 'product',
      cooldownHours: 24,
      resetHours: 168,
      maxRunsPerDay: 1,
      workflow: {
        stages: [
          {
            conditions: [{ op: 'and', condition: { metric: 'stock_drop', threshold: 10, thresholdUnit: 'units', windowHours: 24 } }],
            actions: [{ type: 'notify' }],
          },
          {
            conditions: [{ op: 'and', condition: { metric: 'stock_drop_since_stage', threshold: 3 } }],
            actions: [{ type: 'email' }],
          },
        ],
      },
    },
  },
  {
    key: 'auto-restock',
    name: 'Kritik stokta otomatik stok ekle',
    description: 'Varyant stoğu 10’un altına inince bildirim + stoğu 5 artır.',
    rule: {
      name: 'Kritik stokta otomatik stok ekle',
      granularity: 'variant',
      cooldownHours: 24,
      resetHours: 168,
      maxRunsPerDay: 1,
      workflow: {
        stages: [
          {
            conditions: [{ op: 'and', condition: { metric: 'stock_below', threshold: 10 } }],
            actions: [{ type: 'notify' }, { type: 'adjust_stock', mode: 'increase', amount: 5 }],
          },
        ],
      },
    },
  },
];

export function findTemplate(key: string | null): RuleTemplate | null {
  return RULE_TEMPLATES.find(t => t.key === key) ?? null;
}
