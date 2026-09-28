import { toast } from 'sonner';
import type { PurchaseReportApiResponse, PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import { getActiveCurrency } from '@/lib/currency';
import { printHtml } from '@/lib/documents/print-frame';
import { renderPurchaseReportHtml, type ReportPrintVendor } from '@/lib/documents/purchase-report-html';
import { vendorBasketLines, type BasketState } from './basket';
import { vendorKey } from './VendorTabsPanel';

/**
 * Yazdırılacak gruplar: tedarikçi başına taslaktaki (tikli) satırlar, rapor
 * sırasıyla. `onlyKey` doluysa yalnız o tedarikçi. Boş gruplar düşer.
 */
export function reportPrintVendors(vendors: PurchaseReportVendor[], basket: BasketState, onlyKey: string | null): ReportPrintVendor[] {
  return vendors
    .filter(v => onlyKey === null || vendorKey(v) === onlyKey)
    .map(v => ({
      name: v.vendorId === null ? 'Tedarikçisiz ürünler' : v.vendorName,
      unassigned: v.vendorId === null,
      leadTimeDays: v.leadTimeDays,
      lines: vendorBasketLines(v, basket).map(({ line, qty }) => ({
        productName: line.productName,
        variantName: line.variantName,
        sku: line.sku,
        currentStock: line.currentStock,
        dailyAvg: line.dailyAvg,
        daysOfCover: line.daysOfCover,
        incoming: line.incoming,
        rawQty: line.rawQty,
        suggestedQty: line.suggestedQty,
        needsOrder: line.needsOrder,
        urgent: line.urgent,
        qty,
        unitCost: line.unitCost,
        isEstimate: line.isEstimate,
      })),
    }))
    .filter(v => v.lines.length > 0);
}

/**
 * İç satın alma raporunu ayrı A4 yatay belge olarak yazdırır — ekranın print
 * CSS'i yerine (ad kırpılması, tarayıcı başlık/URL satırları, arayüz artıkları).
 */
export function printReport(
  report: PurchaseReportApiResponse,
  vendors: PurchaseReportVendor[],
  basket: BasketState,
  onlyKey: string | null,
): void {
  const printVendors = reportPrintVendors(vendors, basket, onlyKey);
  if (printVendors.length === 0) {
    toast('Yazdırılacak kalem yok', { description: 'Önce tablodan siparişe ürün ekle.' });
    return;
  }
  printHtml(
    renderPurchaseReportHtml({
      storeName: null,
      generatedAt: report.generatedAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currencyCode: getActiveCurrency(),
      targetStockDays: report.targetStockDays,
      salesWindowDays: report.salesWindowDays,
      vendors: printVendors,
      fontBaseUrl: window.location.origin,
    }),
  );
}
