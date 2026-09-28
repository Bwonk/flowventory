import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { parseVariantName } from '@/lib/products/variant-name';
import { buildInStockMask, computeReplenishment } from '@/lib/reports/purchase';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import type { AuthToken } from '@/models/auth-token';
import { countOpenOrders, getDraftQtyByVariant, getIncomingByVariant } from '@/lib/purchase-orders/queries';

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
  /** Yuvarlanmamış ihtiyaç: hedef seviye − stok − yolda (≥ 0). */
  rawQty: number;
  /** MOQ ve koliye yuvarlanmış öneri; sipariş noktasına inilmediyse 0. */
  suggestedQty: number;
  urgent: boolean;
  /** Gönderilmiş siparişlerde henüz gelmemiş adet. */
  incoming: number;
  /** Yoldaki adetin en yakın beklenen teslim tarihi (ISO). */
  incomingExpectedAt: string | null;
  /** Eldeki stok kaç gün yeter (satış yoksa null). */
  daysOfCover: number | null;
  /** En geç sipariş için kalan gün; ≤ 0 = bugün/gecikti, satış yoksa null. */
  orderInDays: number | null;
  /** Ortalamaya giren stoklu gün sayısı (açıklama balonu için). */
  inStockDays: number;
  /** Tedarikçinin açık taslağındaki adet (tablodaki tik). */
  draftQty: number | null;
  /** Birim maliyet — buyPrice yoksa sellPrice (isEstimate=true). */
  unitCost: number;
  isEstimate: boolean;
  lineTotal: number;
  /**
   * Sipariş önerisi mi? (stok + yolda ≤ sipariş noktası) Tedarikçiye atanmış
   * ürünler öneri olmasa da listeye girer (tab'da tedarikçinin tüm ürünleri
   * görünsün diye); toplamlar yalnız needsOrder satırlarını kapsar.
   */
  needsOrder: boolean;
};

export type PurchaseReportVendor = {
  vendorId: string | null;
  vendorName: string;
  lines: PurchaseReportLine[];
  totalCost: number;
  hasEstimate: boolean;
  /** Etkin tedarik süresi (tedarikçi ayarı ya da mağaza varsayılanı). */
  leadTimeDays: number;
  moq: number | null;
  casePack: number | null;
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
  /** Açık (gönderilmiş / kısmi) sipariş sayısı. */
  openOrderCount: number;
  /** Tüm açık siparişlerde gelmemiş toplam adet. */
  incomingQty: number;
};

/** Stoklu gün maskesi için pencereden önce de bakılır: günün başlangıç stoğu. */
const HISTORY_LOOKBACK_DAYS = SALES_WINDOW_DAYS + 15;

/**
 * Tedarikçi bazlı satın alma önerisi raporu. Sync katmanından
 * (ProductSnapshot + SalesDaily + StockHistory) ve açık siparişlerden
 * hesaplanır; formül `lib/reports/purchase.ts` → `computeReplenishment`.
 * Hem GET /api/reports/purchase hem sipariş gönderimi bu fonksiyonu kullanır.
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
  const historyFrom = new Date(now.getTime() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [snapshots, sales, history, contacts, incomingByVariant, draftByVariant, openOrderCount] = await Promise.all([
    prisma.productSnapshot.findMany({ where: { merchantId } }),
    prisma.salesDaily.findMany({ where: { merchantId, date: { gte: windowStartKey } } }),
    prisma.stockHistory.findMany({
      where: { merchantId, recordedAt: { gte: historyFrom } },
      select: { variantId: true, totalStock: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.vendorContact.findMany({
      where: { merchantId },
      select: { vendorId: true, leadTimeDays: true, moq: true, casePack: true },
    }),
    getIncomingByVariant(merchantId),
    getDraftQtyByVariant(merchantId),
    countOpenOrders(merchantId),
  ]);

  // variantId → (date → qty)
  const salesByVariant = new Map<string, Map<string, number>>();
  for (const row of sales) {
    const byDate = salesByVariant.get(row.variantId) ?? new Map<string, number>();
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.quantity);
    salesByVariant.set(row.variantId, byDate);
  }

  const historyByVariant = new Map<string, Array<{ dateKey: string; totalStock: number }>>();
  for (const row of history) {
    const list = historyByVariant.get(row.variantId) ?? [];
    list.push({ dateKey: dateKeyInTz(row.recordedAt, timezone), totalStock: row.totalStock });
    historyByVariant.set(row.variantId, list);
  }

  const vendorSettings = new Map(contacts.map(c => [c.vendorId, c]));
  const vendors = new Map<string, PurchaseReportVendor>();

  for (const snap of snapshots) {
    const byDate = salesByVariant.get(snap.variantId);
    const hasVendor = snap.vendorId !== null;

    // Tedarikçisiz ürünlerde eski davranış: satışsız / önerisiz satır rapora
    // girmez ("Tedarikçi atanmamış" bir worklist'tir, tüm katalog değil).
    // Tedarikçiye atanmış ürünler ise öneri olmasa da tab'da listelenir.
    if (!byDate && !hasVendor) continue;

    const vendorSetting = snap.vendorId ? vendorSettings.get(snap.vendorId) : undefined;
    const lead = vendorSetting?.leadTimeDays ?? leadTimeDays;
    const incomingInfo = incomingByVariant.get(snap.variantId);
    const incoming = incomingInfo?.qty ?? 0;

    const dailyQuantities = dayKeys.map(key => byDate?.get(key) ?? 0);
    const calc = computeReplenishment({
      dailyQuantities,
      inStockMask: buildInStockMask(dayKeys, historyByVariant.get(snap.variantId) ?? [], dailyQuantities),
      currentStock: snap.totalStock,
      incoming,
      leadTimeDays: lead,
      targetStockDays,
      moq: vendorSetting?.moq ?? null,
      casePack: vendorSetting?.casePack ?? null,
    });

    const needsOrder = calc.needsOrder;
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
      rawQty: calc.rawQty,
      suggestedQty: calc.suggestedQty,
      urgent: calc.urgent,
      incoming,
      incomingExpectedAt: incomingInfo?.expectedAt?.toISOString() ?? null,
      daysOfCover: calc.daysOfCover === null ? null : Math.round(calc.daysOfCover * 10) / 10,
      orderInDays: calc.orderInDays,
      inStockDays: calc.inStockDays,
      draftQty: draftByVariant.get(snap.variantId) ?? null,
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
      leadTimeDays: lead,
      moq: vendorSetting?.moq ?? null,
      casePack: vendorSetting?.casePack ?? null,
    };
    vendor.lines.push(line);
    // Toplam ve ~tahmini yalnız öneri satırlarından — KPI anlamı değişmez.
    if (needsOrder) {
      vendor.totalCost = Math.round((vendor.totalCost + line.lineTotal) * 100) / 100;
      vendor.hasEstimate = vendor.hasEstimate || isEstimate;
    }
    vendors.set(vendorKey, vendor);
  }

  // Öneri satırları üstte (acil önce, sonra en geç sipariş günü, adet),
  // önerisizler ada göre; tedarikçiler maliyete göre, maliyetsizler ada göre sona.
  const vendorList = Array.from(vendors.values())
    .map(v => ({
      ...v,
      lines: v.lines.sort(
        (a, b) =>
          Number(b.needsOrder) - Number(a.needsOrder) ||
          Number(b.urgent) - Number(a.urgent) ||
          (a.orderInDays ?? Number.POSITIVE_INFINITY) - (b.orderInDays ?? Number.POSITIVE_INFINITY) ||
          b.suggestedQty - a.suggestedQty ||
          a.productName.localeCompare(b.productName, 'tr'),
      ),
    }))
    .sort(
      (a, b) => b.totalCost - a.totalCost || a.vendorName.localeCompare(b.vendorName, 'tr'),
    );

  const orderLines = vendorList.flatMap(v => v.lines).filter(l => l.needsOrder);
  let incomingQty = 0;
  for (const info of incomingByVariant.values()) incomingQty += info.qty;

  return {
    generatedAt: now.toISOString(),
    leadTimeDays,
    targetStockDays,
    salesWindowDays: SALES_WINDOW_DAYS,
    vendors: vendorList,
    totalCost: Math.round(orderLines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
    lineCount: orderLines.length,
    urgentCount: orderLines.filter(l => l.urgent).length,
    openOrderCount,
    incomingQty,
  };
}
