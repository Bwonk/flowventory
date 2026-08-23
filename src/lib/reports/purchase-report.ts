import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { computePurchaseLine } from '@/lib/reports/purchase';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import type { AuthToken } from '@/models/auth-token';

/** Satış hızı penceresi (gün). */
const SALES_WINDOW_DAYS = 30;

export type PurchaseReportLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  currentStock: number;
  dailyAvg: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedQty: number;
  urgent: boolean;
  /** Birim maliyet — buyPrice yoksa sellPrice (isEstimate=true). */
  unitCost: number;
  isEstimate: boolean;
  lineTotal: number;
  /**
   * Sipariş önerisi mi? Tedarikçiye atanmış ürünler öneri olmasa da listeye
   * girer (tab'da tedarikçinin tüm ürünleri görünsün diye); toplamlar, e-posta
   * ve yazdırma yalnız needsOrder satırları kapsar.
   */
  needsOrder: boolean;
};

export type PurchaseReportVendor = {
  vendorId: string | null;
  vendorName: string;
  lines: PurchaseReportLine[];
  totalCost: number;
  hasEstimate: boolean;
};

export type PurchaseReportApiResponse = {
  generatedAt: string;
  leadTimeDays: number;
  targetStockDays: number;
  salesWindowDays: number;
  vendors: PurchaseReportVendor[];
  totalCost: number;
  lineCount: number;
  urgentCount: number;
};

function parseVariantName(variantValuesJson: string | null): string | null {
  if (!variantValuesJson) return null;
  try {
    const values = JSON.parse(variantValuesJson) as Array<{ variantValueName?: string | null }>;
    const name = values
      .map(v => v.variantValueName)
      .filter((n): n is string => Boolean(n))
      .join(' · ');
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Tedarikçi bazlı satın alma önerisi raporu. Sync katmanından
 * (ProductSnapshot + SalesDaily) hesaplanır; formül `lib/reports/purchase.ts`.
 * Hem GET /api/reports/purchase hem tedarikçi e-postası bu fonksiyonu kullanır.
 */
export async function buildPurchaseReport(
  merchantId: string,
  authToken: AuthToken,
): Promise<PurchaseReportApiResponse> {
  await ensureFreshSync(merchantId, authToken);

  const settings = await getMerchantSettings(merchantId);
  const { leadTimeDays, targetStockDays, timezone } = settings;

  // Son 30 günün gün anahtarları (bugün dahil).
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = SALES_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dayKeys.push(dateKeyInTz(d, timezone));
  }
  const windowStartKey = dayKeys[0];

  const [snapshots, sales] = await Promise.all([
    prisma.productSnapshot.findMany({ where: { merchantId } }),
    prisma.salesDaily.findMany({ where: { merchantId, date: { gte: windowStartKey } } }),
  ]);

  // variantId → (date → qty)
  const salesByVariant = new Map<string, Map<string, number>>();
  for (const row of sales) {
    const byDate = salesByVariant.get(row.variantId) ?? new Map<string, number>();
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.quantity);
    salesByVariant.set(row.variantId, byDate);
  }

  const vendors = new Map<string, PurchaseReportVendor>();

  for (const snap of snapshots) {
    const byDate = salesByVariant.get(snap.variantId);
    const hasVendor = snap.vendorId !== null;

    // Tedarikçisiz ürünlerde eski davranış: satışsız / önerisiz satır rapora
    // girmez ("Tedarikçi atanmamış" bir worklist'tir, tüm katalog değil).
    // Tedarikçiye atanmış ürünler ise öneri olmasa da tab'da listelenir.
    if (!byDate && !hasVendor) continue;

    const calc = byDate
      ? computePurchaseLine({
          dailyQuantities: dayKeys.map(key => byDate.get(key) ?? 0),
          currentStock: snap.totalStock,
          leadTimeDays,
          targetStockDays,
        })
      : { dailyAvg: 0, safetyStock: 0, reorderPoint: 0, suggestedQty: 0, urgent: false };

    const needsOrder = calc.suggestedQty > 0;
    if (!needsOrder && !hasVendor) continue;

    const isEstimate = snap.buyPrice == null;
    const unitCost = snap.buyPrice ?? snap.sellPrice;

    const line: PurchaseReportLine = {
      variantId: snap.variantId,
      productId: snap.productId,
      productName: snap.productName,
      variantName: parseVariantName(snap.variantValuesJson),
      sku: snap.sku,
      imageUrl: snap.imageUrl,
      currentStock: snap.totalStock,
      dailyAvg: Math.round(calc.dailyAvg * 100) / 100,
      safetyStock: calc.safetyStock,
      reorderPoint: calc.reorderPoint,
      suggestedQty: calc.suggestedQty,
      urgent: needsOrder && calc.urgent,
      unitCost,
      isEstimate,
      lineTotal: needsOrder ? Math.round(calc.suggestedQty * unitCost * 100) / 100 : 0,
      needsOrder,
    };

    const vendorKey = snap.vendorId ?? '__none__';
    const vendor = vendors.get(vendorKey) ?? {
      vendorId: snap.vendorId,
      vendorName: snap.vendorName ?? 'Tedarikçi atanmamış',
      lines: [],
      totalCost: 0,
      hasEstimate: false,
    };
    vendor.lines.push(line);
    // Toplam ve ~tahmini yalnız öneri satırlarından — KPI/e-posta anlamı değişmez.
    if (needsOrder) {
      vendor.totalCost = Math.round((vendor.totalCost + line.lineTotal) * 100) / 100;
      vendor.hasEstimate = vendor.hasEstimate || isEstimate;
    }
    vendors.set(vendorKey, vendor);
  }

  // Öneri satırları üstte (acil önce, sonra adet), önerisizler ada göre;
  // tedarikçiler maliyete göre, maliyetsizler ada göre sona.
  const vendorList = Array.from(vendors.values())
    .map(v => ({
      ...v,
      lines: v.lines.sort(
        (a, b) =>
          Number(b.needsOrder) - Number(a.needsOrder) ||
          Number(b.urgent) - Number(a.urgent) ||
          b.suggestedQty - a.suggestedQty ||
          a.productName.localeCompare(b.productName, 'tr'),
      ),
    }))
    .sort(
      (a, b) => b.totalCost - a.totalCost || a.vendorName.localeCompare(b.vendorName, 'tr'),
    );

  const orderLines = vendorList.flatMap(v => v.lines).filter(l => l.needsOrder);

  return {
    generatedAt: now.toISOString(),
    leadTimeDays,
    targetStockDays,
    salesWindowDays: SALES_WINDOW_DAYS,
    vendors: vendorList,
    totalCost: Math.round(orderLines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
    lineCount: orderLines.length,
    urgentCount: orderLines.filter(l => l.urgent).length,
  };
}
