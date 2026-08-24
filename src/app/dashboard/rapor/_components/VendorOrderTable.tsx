'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DataTable,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableSortHeadCell,
  RowActions,
  type SortDirection,
} from '@/components/shared/data-table/data-table';
import { ListFooter } from '@/components/shared/data-table/ListFooter';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportLine, PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { AnimatedCheckbox } from './AnimatedCheckbox';
import { defaultQtyFor, vendorBasketTotals, type BasketState } from './basket';
import { QuickStockButton } from './QuickStockButton';
import { VendorAssignPopover } from './VendorAssignPopover';

interface VendorOrderTableProps {
  vendor: PurchaseReportVendor;
  token: string | null;
  vendors: VendorListItem[];
  /** variantId → tek tık stok girişi sonrası yeni toplam (Yenile'ye kadar geçerli). */
  stockOverrides: Record<string, number>;
  onStockChange: (variantId: string, newTotalStock: number) => void;
  onAssigned: () => Promise<void>;
  /** Sepet: tikli satırlar ve adetleri; düzenleme sepet çekmecesinde. */
  basket: BasketState;
  onLineQtyChange: (variantId: string, qty: number | null) => void;
}

type SortKey = 'product' | 'sku' | 'stock' | 'daily' | 'reorder' | 'qty' | 'unit' | 'total';

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

/**
 * Tek tedarikçinin sipariş önerisi tablosu — DESIGN.md §5 "Liste kalıbı":
 * sıralanabilir mono başlıklar, seçili satır zemini, hover'da beliren satır
 * aksiyonları, alt bölgede not ↔ seçim çubuğu. Tik = sepette; adet düzenleme
 * sepet çekmecesinde.
 */
export function VendorOrderTable({
  vendor,
  token,
  vendors,
  stockOverrides,
  onStockChange,
  onAssigned,
  basket,
  onLineQtyChange,
}: VendorOrderTableProps) {
  const [sort, setSort] = useState<SortState>({ key: null, direction: 'asc' });
  const toggleSort = (key: SortKey) =>
    setSort(prev =>
      prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    );

  const checkedCount = vendor.lines.filter(line => line.variantId in basket).length;
  const allChecked = checkedCount === vendor.lines.length && vendor.lines.length > 0;
  const headerState: boolean | 'mixed' = allChecked ? true : checkedCount > 0 ? 'mixed' : false;
  const totals = vendorBasketTotals(vendor, basket);

  // Hepsi tikliyse hepsini çıkar; hiçbiri/kısmi ise eksikleri varsayılanla ekle.
  const toggleAll = () => {
    for (const line of vendor.lines) {
      if (allChecked) onLineQtyChange(line.variantId, null);
      else if (!(line.variantId in basket)) onLineQtyChange(line.variantId, defaultQtyFor(line));
    }
  };
  const clearSelection = () => {
    for (const line of vendor.lines) {
      if (line.variantId in basket) onLineQtyChange(line.variantId, null);
    }
  };

  // Sıralama istemcide, rapor sırası (aciliyet) varsayılan; '—' hücreler sona.
  const sortedLines = useMemo(() => {
    if (sort.key === null) return vendor.lines;
    const value = (line: PurchaseReportLine): string | number => {
      const inBasket = line.variantId in basket;
      switch (sort.key) {
        case 'product':
          return line.productName;
        case 'sku':
          return line.sku ?? '';
        case 'stock':
          return stockOverrides[line.variantId] ?? line.currentStock;
        case 'daily':
          return line.dailyAvg;
        case 'reorder':
          return line.needsOrder ? line.reorderPoint : -1;
        case 'qty':
          return inBasket ? basket[line.variantId] : line.needsOrder ? line.suggestedQty : -1;
        case 'unit':
          return line.unitCost;
        case 'total':
          return inBasket ? basket[line.variantId] * line.unitCost : -1;
        default:
          return 0;
      }
    };
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...vendor.lines].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'tr') * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [vendor.lines, sort, basket, stockOverrides]);

  const sortProps = { activeKey: sort.key, direction: sort.direction, onSort: toggleSort };

  return (
    <>
      <DataTable>
        <DataTableHeaderRow className="print:border-neutral-400">
          <DataTableHeadCell edge className="w-10 pr-0 print:hidden">
            <AnimatedCheckbox
              checked={headerState}
              onToggle={toggleAll}
              label="Hepsini seç"
              title={
                headerState === 'mixed'
                  ? 'Kısmi seçim — tümünü seçmek için tıkla'
                  : headerState
                    ? 'Tüm satırlar sepette — kaldırmak için tıkla'
                    : 'Tümünü sepete ekle'
              }
            />
          </DataTableHeadCell>
          <DataTableSortHeadCell sortKey="product" className="print:pl-5" {...sortProps}>
            Ürün
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="sku" {...sortProps}>
            SKU
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="stock" align="right" {...sortProps}>
            Stok
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="daily" align="right" {...sortProps}>
            Günlük Satış
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="reorder" align="right" {...sortProps}>
            Sipariş Noktası
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="qty" align="right" {...sortProps}>
            Adet
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="unit" align="right" {...sortProps}>
            Birim
          </DataTableSortHeadCell>
          <DataTableSortHeadCell sortKey="total" align="right" edge {...sortProps}>
            Tutar
          </DataTableSortHeadCell>
          <DataTableHeadCell edge className="w-[104px] pl-3 print:hidden">
            <span className="sr-only">İşlem</span>
          </DataTableHeadCell>
        </DataTableHeaderRow>
        <tbody>
          {sortedLines.map(line => {
            const inBasket = line.variantId in basket;
            const qty = basket[line.variantId];
            return (
              <DataTableRow
                key={line.variantId}
                selected={inBasket}
                // Sepette olmayan satırlar çıktı (sipariş listesi) dışında kalır.
                className={cn('print:border-neutral-400 print:bg-transparent', !inBasket && 'print:hidden')}
              >
                <DataTableCell edge className="w-10 pr-0 print:hidden">
                  <AnimatedCheckbox
                    checked={inBasket}
                    onToggle={() => onLineQtyChange(line.variantId, inBasket ? null : defaultQtyFor(line))}
                    label={`${line.productName} sepete ekle`}
                  />
                </DataTableCell>
                <DataTableCell className="print:pl-5">
                  <div className="flex items-center gap-2.5">
                    {line.imageUrl && (
                      <Image
                        src={line.imageUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded object-cover print:hidden"
                        unoptimized
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {line.productName}
                        {line.urgent && (
                          <Badge variant="critical" className="ml-1.5 align-middle">
                            <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                            acil
                          </Badge>
                        )}
                      </p>
                      {line.variantName && (
                        <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>
                      )}
                    </div>
                  </div>
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">{line.sku ?? '—'}</DataTableCell>
                <DataTableCell numeric>{stockOverrides[line.variantId] ?? line.currentStock}</DataTableCell>
                <DataTableCell numeric>{line.dailyAvg.toLocaleString('tr-TR')}</DataTableCell>
                <DataTableCell numeric className="text-muted-foreground">
                  {line.needsOrder ? line.reorderPoint : '—'}
                </DataTableCell>
                {/* Adet: sepetteki adet basılır; öneriden sapmışsa öneri soluk not olur. */}
                <DataTableCell numeric>
                  {inBasket ? (
                    <span className="font-semibold">
                      {qty}
                      {line.needsOrder && qty !== line.suggestedQty && (
                        <span
                          className="ml-1 text-xs font-normal text-muted-foreground print:hidden"
                          title="Sistem önerisi"
                        >
                          öneri {line.suggestedQty}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      {line.needsOrder ? line.suggestedQty : '—'}
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell
                  numeric
                  className={line.isEstimate ? 'cursor-help' : undefined}
                >
                  <span title={line.isEstimate ? 'Alış fiyatı tanımlı değil; satış fiyatı kullanıldı' : undefined}>
                    {formatPrice(line.unitCost)}
                  </span>
                </DataTableCell>
                <DataTableCell numeric edge className="font-medium">
                  {inBasket ? (
                    formatPrice(qty * line.unitCost)
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  )}
                </DataTableCell>
                <DataTableCell edge className="pl-3 print:hidden">
                  {token && (
                    <RowActions>
                      {vendor.vendorId === null && (
                        <VendorAssignPopover
                          token={token}
                          productId={line.productId}
                          vendors={vendors}
                          onAssigned={onAssigned}
                        />
                      )}
                      {(line.needsOrder || inBasket) && (
                        <QuickStockButton
                          token={token}
                          productId={line.productId}
                          variantId={line.variantId}
                          addQty={qty ?? line.suggestedQty}
                          onStockChange={onStockChange}
                        />
                      )}
                    </RowActions>
                  )}
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </tbody>
      </DataTable>
      <ListFooter
        className="print:hidden"
        note={`${vendor.lines.length} satır · ${vendor.vendorId === null ? 'Tedarikçi atanmamış' : vendor.vendorName}`}
        selectedCount={checkedCount}
        onClearSelection={clearSelection}
        selection={
          <p className="text-sm tabular-nums text-foreground">
            <span className="font-medium">{formatPrice(totals.total)}</span>
            {totals.hasEstimate && (
              <span
                className="ml-1 text-xs text-muted-foreground"
                title="Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı"
              >
                tahmini
              </span>
            )}
          </p>
        }
      />
    </>
  );
}
