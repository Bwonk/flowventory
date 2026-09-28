import { logger } from '@/lib/logger';
import { applyDraftChanges } from '@/lib/purchase-orders/drafts';
import { computeReplenishment, ORDER_ROUNDING_MULTIPLE, roundUpToMultiple } from '@/lib/reports/purchase';
import type { RuleActionResult, RuleTarget } from '../types';

export interface DraftActionContext {
  merchantId: string;
  currencyCode: string;
  target: RuleTarget;
  /** Turda bir kez yüklenir: variantId → açık taslaktaki adet. */
  draftQty: ReadonlyMap<string, number>;
  /** variantId → gönderilmiş siparişlerde gelmemiş adet. */
  incoming: ReadonlyMap<string, number>;
  /** vendorId → tedarikçi ayarları. */
  vendorSettings: ReadonlyMap<string, { leadTimeDays: number | null; moq: number | null; casePack: number | null }>;
}

const fail = (detail: string): RuleActionResult => ({ type: 'add_to_draft', ok: false, detail });

/**
 * "Taslağa ekle": varyant tedarikçisinin açık taslağına Satın Alma raporuyla
 * aynı formülün önerisiyle eklenir. Taslakta zaten varsa kullanıcının adedine
 * dokunulmaz. Stoğa yazmaz — sipariş yine kullanıcı gönderince gider.
 */
export async function addToDraftAction(ctx: DraftActionContext): Promise<RuleActionResult> {
  const { target } = ctx;
  if (!target.variantId) return fail('Taslağa ekleme varyant düzeyinde çalışır');
  if (!target.vendorId) return fail('Tedarikçi atanmamış; taslağa eklenemedi');
  if (ctx.draftQty.has(target.variantId)) return { type: 'add_to_draft', ok: true, detail: 'Zaten taslakta; adede dokunulmadı' };

  const settings = ctx.vendorSettings.get(target.vendorId);
  const casePack = settings?.casePack ?? null;
  const moq = settings?.moq ?? null;
  const calc = computeReplenishment({
    dailyQuantities: target.dailyQuantities,
    currentStock: target.currentStock,
    incoming: ctx.incoming.get(target.variantId) ?? 0,
    leadTimeDays: settings?.leadTimeDays ?? target.leadTimeDays,
    targetStockDays: target.targetStockDays,
    moq,
    casePack,
  });
  // Koşul sipariş noktasından önce tetiklendiyse (ör. "stok 10'un altında") ham ihtiyaç yuvarlanır.
  const qty =
    calc.suggestedQty > 0
      ? calc.suggestedQty
      : roundUpToMultiple(Math.max(calc.rawQty, moq ?? 0, 1), casePack ?? ORDER_ROUNDING_MULTIPLE);

  try {
    await applyDraftChanges(ctx.merchantId, ctx.currencyCode, { set: [{ variantId: target.variantId, qty }], remove: [] });
    return { type: 'add_to_draft', ok: true, detail: `Taslağa ${qty.toLocaleString('tr-TR')} adet eklendi` };
  } catch (error) {
    logger.error('Rule draft action failed', { merchantId: ctx.merchantId, variantId: target.variantId, error });
    return fail('Taslak yazılamadı');
  }
}
