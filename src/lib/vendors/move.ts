import { getIkas } from '@/helpers/api-helpers';
import { logger } from '@/lib/logger';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { applyDraftChanges } from '@/lib/purchase-orders/drafts';
import { refreshProductSnapshot } from '@/lib/sync/ikas-sync';
import type { AuthToken } from '@/models/auth-token';

/**
 * Tedarikçinin tüm ürünlerini başka bir isme taşır. ikas'ta tedarikçi CRUD'u
 * yok ve ürünü tedarikçisiz bırakmak mümkün değil; tek yol ürünleri
 * `updateProduct(vendor: { name })` ile yeni isme atamak.
 *
 * - `merge`: hedef mevcut bir tedarikçi; bitince kaynak (iletişim + taslak) silinir.
 * - `rename`: hedef yeni bir isim; bitince iletişim/tedarik ayarları ve açık
 *   siparişler yeni tedarikçiye taşınır.
 *
 * Çok ürünlü tedarikçide istek süresi dolmasın diye adım adım çalışır:
 * her çağrı bütçe içinde bir parti taşır, istemci `done` olana kadar tekrar çağırır.
 */

export type VendorMoveMode = 'merge' | 'rename';

export type VendorMoveStep = {
  done: boolean;
  /** Bu adımda taşınan ürün sayısı. */
  moved: number;
  /** Kaynakta kalan ürün sayısı (adım sonrası). */
  remaining: number;
  /** ikas'ın reddettiği ürünler — istemci durur. */
  failed: string[];
  toVendorId: string | null;
  toVendorName: string;
};

export class VendorMoveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'VendorMoveError';
  }
}

const BATCH = 20;
const BUDGET_MS = 40_000;
const same = (a: string, b: string) => a.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr');

async function vendorNames(merchantId: string): Promise<Array<{ vendorId: string; vendorName: string }>> {
  const [snapshots, contacts] = await Promise.all([
    prisma.productSnapshot.findMany({
      where: { merchantId, vendorId: { not: null } },
      distinct: ['vendorId'],
      select: { vendorId: true, vendorName: true },
    }),
    prisma.vendorContact.findMany({ where: { merchantId }, select: { vendorId: true, vendorName: true } }),
  ]);
  const map = new Map<string, string>();
  for (const s of snapshots) if (s.vendorId) map.set(s.vendorId, s.vendorName ?? s.vendorId);
  for (const c of contacts) if (!map.has(c.vendorId)) map.set(c.vendorId, c.vendorName);
  return Array.from(map, ([vendorId, vendorName]) => ({ vendorId, vendorName }));
}

async function finalize(
  merchantId: string,
  fromVendorId: string,
  toVendorId: string | null,
  toVendorName: string,
  mode: VendorMoveMode,
): Promise<void> {
  // Kaynağın açık taslağı: ürünler artık hedefte, satırlar hedefin taslağına geçer.
  const draftLines = await prisma.purchaseOrderLine.findMany({
    where: { merchantId, order: { vendorId: fromVendorId, status: 'draft' } },
    select: { variantId: true, qty: true },
  });
  if (draftLines.length > 0) {
    const { currencyCode } = await getMerchantSettings(merchantId);
    await applyDraftChanges(merchantId, currencyCode, { set: draftLines, remove: [] });
  }
  await prisma.purchaseOrder.deleteMany({ where: { merchantId, vendorId: fromVendorId, status: 'draft' } });

  const source = await prisma.vendorContact.findUnique({
    where: { merchantId_vendorId: { merchantId, vendorId: fromVendorId } },
  });

  if (mode === 'rename' && toVendorId && source) {
    const carried = {
      vendorName: toVendorName,
      email: source.email,
      phone: source.phone,
      leadTimeDays: source.leadTimeDays,
      moq: source.moq,
      casePack: source.casePack,
    };
    await prisma.$transaction([
      prisma.vendorContact.upsert({
        where: { merchantId_vendorId: { merchantId, vendorId: toVendorId } },
        create: { merchantId, vendorId: toVendorId, ...carried },
        update: carried,
      }),
      // Yolda / geçmiş siparişler yeni adla görünsün.
      prisma.purchaseOrder.updateMany({
        where: { merchantId, vendorId: fromVendorId },
        data: { vendorId: toVendorId, vendorName: toVendorName },
      }),
    ]);
  }
  if (source && toVendorId !== fromVendorId) {
    await prisma.vendorContact.delete({ where: { id: source.id } });
  }
}

export async function moveVendorStep(
  merchantId: string,
  authToken: AuthToken,
  input: { fromVendorId: string; toVendorName: string; mode: VendorMoveMode },
): Promise<VendorMoveStep> {
  const toVendorName = input.toVendorName.trim();
  const { fromVendorId, mode } = input;
  const vendors = await vendorNames(merchantId);
  const source = vendors.find(v => v.vendorId === fromVendorId);
  if (!source) throw new VendorMoveError('Tedarikçi bulunamadı', 404);
  if (same(source.vendorName, toVendorName)) throw new VendorMoveError('Yeni ad mevcut adla aynı', 400);

  const existing = vendors.find(v => v.vendorId !== fromVendorId && same(v.vendorName, toVendorName));
  if (mode === 'rename' && existing) {
    throw new VendorMoveError('Bu isimde tedarikçi zaten var. Birleştirmek için "Ürünleri taşı ve sil"i kullanın.', 409);
  }
  if (mode === 'merge' && !existing) throw new VendorMoveError('Hedef tedarikçi bulunamadı', 404);

  const products = await prisma.productSnapshot.findMany({
    where: { merchantId, vendorId: fromVendorId },
    distinct: ['productId'],
    select: { productId: true },
  });

  // Ürünsüz (yerel) tedarikçide yeniden adlandırma yalnız kayıttır.
  if (products.length === 0 && mode === 'rename') {
    await prisma.vendorContact.updateMany({ where: { merchantId, vendorId: fromVendorId }, data: { vendorName: toVendorName } });
    return { done: true, moved: 0, remaining: 0, failed: [], toVendorId: fromVendorId, toVendorName };
  }

  const ikasClient = getIkas(authToken);
  const startedAt = Date.now();
  let toVendorId: string | null = existing?.vendorId ?? null;
  const failed: string[] = [];
  let moved = 0;

  for (const { productId } of products.slice(0, BATCH)) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    try {
      const response = await ikasClient.mutations.updateProduct({ input: { id: productId, vendor: { name: toVendorName } } });
      const vendor = response.data?.updateProduct?.vendor;
      if (!response.isSuccess || !vendor) {
        logger.warn('Vendor move rejected by ikas', {
          productId,
          reason: response.errors?.map(e => e.message).join('; ') || response.error,
        });
        failed.push(productId);
        continue;
      }
      toVendorId = vendor.id;
      moved++;
      await refreshProductSnapshot(merchantId, authToken, productId).catch(error => {
        logger.warn('Snapshot refresh after vendor move failed', { productId, error });
      });
    } catch (error) {
      logger.warn('Vendor move failed for product', { productId, error });
      failed.push(productId);
    }
  }

  const remaining = await prisma.productSnapshot.count({ where: { merchantId, vendorId: fromVendorId } });
  const done = remaining === 0 && failed.length === 0;
  if (done) await finalize(merchantId, fromVendorId, toVendorId, toVendorName, mode);
  return { done, moved, remaining, failed, toVendorId, toVendorName };
}
