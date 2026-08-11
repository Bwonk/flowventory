import { logger } from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getMerchantSettings } from '@/lib/merchant-settings';
import { prisma } from '@/lib/prisma';
import { computePurchaseLine } from '@/lib/reports/purchase';
import { ensureFreshSync } from '@/lib/sync/ikas-sync';
import { dateKeyInTz } from '@/lib/timezone';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

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
 * GET /api/reports/purchase
 *
 * Tedarikçi bazlı satın alma önerisi raporu. Sync katmanından
 * (ProductSnapshot + SalesDaily) hesaplanır; formül `lib/reports/purchase.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

    const { merchantId } = user;
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
      // Hiç satışı olmayan varyanta sipariş önerilmez (ölü stok başka rapora ait).
      if (!byDate) continue;

      const dailyQuantities = dayKeys.map(key => byDate.get(key) ?? 0);
      const calc = computePurchaseLine({
        dailyQuantities,
        currentStock: snap.totalStock,
        leadTimeDays,
        targetStockDays,
      });

      if (calc.suggestedQty <= 0) continue;

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
        urgent: calc.urgent,
        unitCost,
        isEstimate,
        lineTotal: Math.round(calc.suggestedQty * unitCost * 100) / 100,
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
      vendor.totalCost = Math.round((vendor.totalCost + line.lineTotal) * 100) / 100;
      vendor.hasEstimate = vendor.hasEstimate || isEstimate;
      vendors.set(vendorKey, vendor);
    }

    // Acil satırlar üstte, sonra sipariş adedine göre; tedarikçiler maliyete göre.
    const vendorList = Array.from(vendors.values())
      .map(v => ({
        ...v,
        lines: v.lines.sort(
          (a, b) => Number(b.urgent) - Number(a.urgent) || b.suggestedQty - a.suggestedQty,
        ),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const allLines = vendorList.flatMap(v => v.lines);

    const data: PurchaseReportApiResponse = {
      generatedAt: now.toISOString(),
      leadTimeDays,
      targetStockDays,
      salesWindowDays: SALES_WINDOW_DAYS,
      vendors: vendorList,
      totalCost: Math.round(allLines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
      lineCount: allLines.length,
      urgentCount: allLines.filter(l => l.urgent).length,
    };

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Purchase report error', { error });
    return NextResponse.json({ error: 'Failed to build purchase report' }, { status: 500 });
  }
}
