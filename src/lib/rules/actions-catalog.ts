/**
 * Aksiyon kataloğu — form, cümle ve motor aynı kaynaktan beslenir (koşul
 * kataloğu deseni). Bildirim ve e-posta artık kuralın tipi değil, birer
 * aksiyon; yanlarında gerçek iş yapan aksiyonlar (stok yazımı) durur.
 * Saf: yürütücüler `actions/` altında.
 */

import {
  MAX_STOCK,
  MAX_STOCK_STEP,
  type ActionOf,
  type RuleAction,
  type RuleActionType,
  type RuleWorkflow,
  type StockAdjustMode,
} from './types';

/** İkon anahtarı — UI lucide ikonuna eşler (lib React'e dokunmaz). */
export type ActionIcon = 'bell' | 'mail' | 'package-plus';

export type ActionInput = { kind: 'none' } | { kind: 'stock' };

export interface ActionDef<T extends RuleActionType = RuleActionType> {
  type: T;
  label: string;
  hint: string;
  icon: ActionIcon;
  input: ActionInput;
  /** Dışarıya (ikas) yazan aksiyon — kartta uyarı, kayıtta onay. */
  danger?: string;
  /** Kayıtlı bildirim adresi ister. */
  needsEmail?: true;
  /** Cümle içi: "bildirim gönder", "stoğu 5 artır". */
  describe: (a: ActionOf<T>) => string;
  /** Liste kolonu için kısa etiket: "Bildirim", "Stok +5". */
  short: (a: ActionOf<T>) => string;
}

const fmt = (n: number) => n.toLocaleString('tr-TR');

export const STOCK_MODE_LABELS: Record<StockAdjustMode, string> = { increase: 'Artır', set: 'Ayarla' };

export const ACTION_CATALOG: { [T in RuleActionType]: ActionDef<T> } = {
  notify: {
    type: 'notify',
    label: 'Bildirim gönder',
    hint: 'Zilde bildirim oluşturur.',
    icon: 'bell',
    input: { kind: 'none' },
    describe: () => 'bildirim gönder',
    short: () => 'Bildirim',
  },
  email: {
    type: 'email',
    label: 'E-posta gönder',
    hint: 'Ayarlar’daki bildirim adresine gider; aynı turdaki tetikler tek e-postada toplanır.',
    icon: 'mail',
    input: { kind: 'none' },
    needsEmail: true,
    describe: () => 'e-posta gönder',
    short: () => 'E-posta',
  },
  adjust_stock: {
    type: 'adjust_stock',
    label: 'Stoğu değiştir',
    hint: `Varyantın ilk deposuna yazar. Tek seferde en fazla +${fmt(MAX_STOCK_STEP)} adet; her yazım bildirim üretir ve geri alınabilir.`,
    icon: 'package-plus',
    input: { kind: 'stock' },
    danger: 'ikas admin’deki stoğa otomatik yazar.',
    describe: a => (a.mode === 'increase' ? `stoğu ${fmt(a.amount)} artır` : `stoğu ${fmt(a.amount)} yap`),
    short: a => (a.mode === 'increase' ? `Stok +${fmt(a.amount)}` : `Stok = ${fmt(a.amount)}`),
  },
};

// Katalog girdileri tipe özel tiplenir; ortak dispatch için gevşek görünüm.
type AnyActionDef = { describe: (a: RuleAction) => string; short: (a: RuleAction) => string };

export function describeAction(a: RuleAction): string {
  return (ACTION_CATALOG[a.type] as unknown as AnyActionDef).describe(a);
}

export function shortActionLabel(a: RuleAction): string {
  return (ACTION_CATALOG[a.type] as unknown as AnyActionDef).short(a);
}

/** Aksiyon tipi seçilince makul başlangıç gövdesi (form). */
export function defaultAction(type: RuleActionType): RuleAction {
  switch (type) {
    case 'notify':
      return { type };
    case 'email':
      return { type };
    case 'adjust_stock':
      return { type, mode: 'increase', amount: 5 };
  }
}

export function workflowActions(workflow: RuleWorkflow): RuleAction[] {
  return workflow.stages.flatMap(s => s.actions);
}

export function hasActionType(workflow: RuleWorkflow, type: RuleActionType): boolean {
  return workflowActions(workflow).some(a => a.type === type);
}

export type StockComputation =
  | { ok: true; next: number }
  | { ok: false; reason: string };

/**
 * Stok aksiyonunun saf kısmı: canlı stok + aksiyon → yazılacak mutlak değer.
 * Emniyet (K5): tek yazımda en fazla +MAX_STOCK_STEP; "ayarla" stoğu asla
 * azaltmaz (düşük stok kuralının amacı doldurmak — satışı silmek değil).
 */
export function computeNewStock(
  mode: StockAdjustMode,
  amount: number,
  current: number,
  limits: { maxStep: number; maxStock: number } = { maxStep: MAX_STOCK_STEP, maxStock: MAX_STOCK },
): StockComputation {
  const base = Math.max(0, current);
  const next = mode === 'increase' ? base + amount : amount;
  const delta = next - base;
  if (delta <= 0) return { ok: false, reason: `Stok zaten ${fmt(base)} adet — değişiklik gerekmedi` };
  if (delta > limits.maxStep) return { ok: false, reason: `Tek seferde en fazla +${fmt(limits.maxStep)} adet yazılabilir` };
  if (next > limits.maxStock) return { ok: false, reason: 'Stok üst sınırı aşılıyor' };
  return { ok: true, next };
}
