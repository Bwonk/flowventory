import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseVariantName } from '@/lib/products/variant-name';

export const MAX_LINE_QTY = 100_000;

/** Etkileşimli işlem süre sınırı — varsayılan 5 sn Neon gecikmesinde dar kalabilir. */
export const TX_TIMEOUT_MS = 15_000;

export type DraftLineInput = { variantId: string; qty: number };

type SnapshotRow = {
  productId: string;
  variantId: string;
  productName: string;
  variantValuesJson: string | null;
  sku: string | null;
  vendorId: string | null;
  vendorName: string | null;
  buyPrice: number | null;
};

async function loadSnapshots(merchantId: string, variantIds: string[]): Promise<Map<string, SnapshotRow>> {
  if (variantIds.length === 0) return new Map();
  const rows = await prisma.productSnapshot.findMany({
    where: { merchantId, variantId: { in: variantIds } },
    select: {
      productId: true,
      variantId: true,
      productName: true,
      variantValuesJson: true,
      sku: true,
      vendorId: true,
      vendorName: true,
      buyPrice: true,
    },
  });
  return new Map(rows.map(r => [r.variantId, r]));
}

/**
 * Tedarikçinin açık taslağı; yoksa oluşturur. Kısmi unique indeks
 * (tedarikçi başına tek taslak) eşzamanlı oluşturmada biri kaybeder → yeniden okunur.
 */
export async function ensureDraft(
  tx: Prisma.TransactionClient | typeof prisma,
  merchantId: string,
  vendorId: string,
  vendorName: string,
  currencyCode: string,
): Promise<{ id: string }> {
  const existing = await tx.purchaseOrder.findFirst({ where: { merchantId, vendorId, status: 'draft' }, select: { id: true } });
  if (existing) return existing;
  try {
    return await tx.purchaseOrder.create({
      data: { merchantId, vendorId, vendorName, status: 'draft', currencyCode },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const again = await tx.purchaseOrder.findFirst({ where: { merchantId, vendorId, status: 'draft' }, select: { id: true } });
      if (again) return again;
    }
    throw error;
  }
}

function lineData(merchantId: string, snap: SnapshotRow, qty: number) {
  return {
    merchantId,
    productId: snap.productId,
    variantId: snap.variantId,
    sku: snap.sku,
    productName: snap.productName,
    variantName: parseVariantName(snap.variantValuesJson),
    qty,
    unitCost: snap.buyPrice,
  };
}

/**
 * Satın Alma tablosundaki tik/adet değişiklikleri. Tedarikçi ürünün kendi
 * snapshot'ından okunur (istemciye güvenilmez); tedarikçisiz ürün yok sayılır.
 * Boşalan taslak silinir.
 */
export async function applyDraftChanges(
  merchantId: string,
  currencyCode: string,
  changes: { set: DraftLineInput[]; remove: string[] },
): Promise<void> {
  const snapshots = await loadSnapshots(merchantId, changes.set.map(c => c.variantId));

  // Tedarikçiye göre grupla (tedarikçisiz ürün yok sayılır); son değer kazanır.
  const byVendor = new Map<string, { vendorName: string; lines: Map<string, number> }>();
  for (const { variantId, qty } of changes.set) {
    const snap = snapshots.get(variantId);
    if (!snap?.vendorId) continue;
    const group = byVendor.get(snap.vendorId) ?? { vendorName: snap.vendorName ?? snap.vendorId, lines: new Map() };
    group.lines.set(variantId, qty);
    byVendor.set(snap.vendorId, group);
  }

  // Toplu sorgular: "Hepsini seç" yüzlerce satırı tek istekte getirebilir.
  await prisma.$transaction(
    async tx => {
      const touched = [...changes.remove, ...changes.set.map(c => c.variantId)];
      if (touched.length > 0) {
        // Kaldırılan + yeniden yazılacak satırlar (ürün tedarikçi değiştirdiyse eski taslaktaki de) silinir.
        await tx.purchaseOrderLine.deleteMany({ where: { merchantId, variantId: { in: touched }, order: { status: 'draft' } } });
      }
      for (const [vendorId, group] of byVendor) {
        const draft = await ensureDraft(tx, merchantId, vendorId, group.vendorName, currencyCode);
        await tx.purchaseOrderLine.createMany({
          data: Array.from(group.lines, ([variantId, qty]) => ({
            orderId: draft.id,
            ...lineData(merchantId, snapshots.get(variantId)!, qty),
          })),
        });
      }
      await tx.purchaseOrder.deleteMany({ where: { merchantId, status: 'draft', lines: { none: {} } } });
    },
    { timeout: TX_TIMEOUT_MS },
  );
}

/** Gönderimden hemen önce: taslağın satırları istemcinin son hâline eşitlenir. */
export async function replaceDraftLines(
  tx: Prisma.TransactionClient,
  merchantId: string,
  vendorId: string,
  vendorName: string,
  currencyCode: string,
  lines: DraftLineInput[],
): Promise<{ id: string; skipped: number }> {
  const snapshots = await loadSnapshots(merchantId, lines.map(l => l.variantId));
  const valid = lines.filter(l => snapshots.get(l.variantId)?.vendorId === vendorId);
  const draft = await ensureDraft(tx, merchantId, vendorId, vendorName, currencyCode);
  await tx.purchaseOrderLine.deleteMany({ where: { orderId: draft.id } });
  await tx.purchaseOrderLine.deleteMany({
    where: { merchantId, variantId: { in: valid.map(l => l.variantId) }, order: { status: 'draft' } },
  });
  await tx.purchaseOrderLine.createMany({
    data: valid.map(l => ({ orderId: draft.id, ...lineData(merchantId, snapshots.get(l.variantId)!, l.qty) })),
  });
  return { id: draft.id, skipped: lines.length - valid.length };
}
