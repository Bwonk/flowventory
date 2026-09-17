import { describe, expect, it } from 'vitest';
import {
  ACTION_CATALOG,
  computeNewStock,
  defaultAction,
  describeAction,
  hasActionType,
  shortActionLabel,
} from '@/lib/rules/actions-catalog';
import { actionSchema } from '@/lib/rules/schema';
import { RULE_ACTION_TYPES } from '@/lib/rules/types';

describe('aksiyon kataloğu', () => {
  it('her tip etiketli ve varsayılanı şemadan geçer', () => {
    for (const t of RULE_ACTION_TYPES) {
      expect(ACTION_CATALOG[t].label.length).toBeGreaterThan(0);
      expect(actionSchema.safeParse(defaultAction(t)).success).toBe(true);
    }
  });
  it('yalnız stok aksiyonu tehlikeli, yalnız e-posta adres ister', () => {
    expect(RULE_ACTION_TYPES.filter(t => ACTION_CATALOG[t].danger)).toEqual(['adjust_stock']);
    expect(RULE_ACTION_TYPES.filter(t => ACTION_CATALOG[t].needsEmail)).toEqual(['email']);
  });
  it('cümle ve kısa etiketler', () => {
    expect(describeAction({ type: 'notify' })).toBe('bildirim gönder');
    expect(describeAction({ type: 'email' })).toBe('e-posta gönder');
    expect(describeAction({ type: 'adjust_stock', mode: 'increase', amount: 5 })).toBe('stoğu 5 artır');
    expect(describeAction({ type: 'adjust_stock', mode: 'set', amount: 1200 })).toBe('stoğu 1.200 yap');
    expect(shortActionLabel({ type: 'adjust_stock', mode: 'increase', amount: 5 })).toBe('Stok +5');
    expect(shortActionLabel({ type: 'adjust_stock', mode: 'set', amount: 20 })).toBe('Stok = 20');
  });
  it('hasActionType aşamalar boyunca arar', () => {
    const workflow = {
      stages: [
        { conditions: [], actions: [{ type: 'notify' as const }] },
        { conditions: [], actions: [{ type: 'email' as const }] },
      ],
    };
    expect(hasActionType(workflow, 'email')).toBe(true);
    expect(hasActionType(workflow, 'adjust_stock')).toBe(false);
  });
});

describe('computeNewStock', () => {
  const limits = { maxStep: 1000, maxStock: 1_000_000 };
  it('artır: mevcut + adet', () => {
    expect(computeNewStock('increase', 5, 10, limits)).toEqual({ ok: true, next: 15 });
  });
  it('negatif canlı stok 0 sayılır', () => {
    expect(computeNewStock('increase', 5, -3, limits)).toEqual({ ok: true, next: 5 });
  });
  it('ayarla: hedef değere yazar ama stoğu azaltmaz', () => {
    expect(computeNewStock('set', 20, 4, limits)).toEqual({ ok: true, next: 20 });
    expect(computeNewStock('set', 20, 20, limits)).toMatchObject({ ok: false });
    expect(computeNewStock('set', 20, 35, limits)).toMatchObject({ ok: false });
  });
  it('adım başına +1.000 sınırı', () => {
    expect(computeNewStock('increase', 1000, 0, limits)).toEqual({ ok: true, next: 1000 });
    expect(computeNewStock('set', 1100, 100, limits)).toEqual({ ok: true, next: 1100 });
    expect(computeNewStock('set', 1500, 0, limits)).toMatchObject({ ok: false, reason: 'Tek seferde en fazla +1.000 adet yazılabilir' });
  });
  it('mutlak üst sınır', () => {
    expect(computeNewStock('increase', 10, 999_995, limits)).toMatchObject({ ok: false, reason: 'Stok üst sınırı aşılıyor' });
  });
});
