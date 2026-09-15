'use client';

import { useCallback, useMemo } from 'react';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, type SelectionChange, type TableColumn } from '@/components/motion/table';
import { RowActions } from '@/components/shared/data-table/RowActions';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportLine, PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { defaultQtyFor, type BasketState } from './basket';
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

/**
 * Tek tedarikçinin sipariş önerisi tablosu — DESIGN.md §5 "Liste kalıbı":
 * sıralanabilir mono başlıklar, seçili satır zemini, hover'da beliren satır
 * aksiyonları, alt bölgede not ↔ seçim çubuğu. Tik = sepette; adet düzenleme
 * sepet çekmecesinde. Sıralama istemcide (tr), rapor sırası (aciliyet)
 * varsayılan; "—" hücreler her yönde sona düşer. Yazdırmada yalnız sepetteki
 * satırlar çıkar.
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
  const selectedRowIds = useMemo(
    () => vendor.lines.filter(line => line.variantId in basket).map(line => line.variantId),
    [vendor.lines, basket],
  );
  const lineById = useMemo(() => new Map(vendor.lines.map(line => [line.variantId, line])), [vendor.lines]);

  // Seçim sepeti sürer: eklenen satır varsayılan adetle girer, çıkan düşer.
  const handleSelectionChange = useCallback(
    (_ids: string[], { added, removed }: SelectionChange) => {
      for (const id of added) {
        const line = lineById.get(id);
        if (line) onLineQtyChange(id, defaultQtyFor(line));
      }
      for (const id of removed) onLineQtyChange(id, null);
    },
    [lineById, onLineQtyChange],
  );
  const columns = useMemo<TableColumn<PurchaseReportLine>[]>(
    () => [
      {
        key: 'product',
        header: 'Ürün',
        sortable: true,
        minWidth: 220,
        sortValue: line => line.productName,
        cell: line => (
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
                    Acil
                  </Badge>
                )}
              </p>
              {line.variantName && <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>}
            </div>
          </div>
        ),
      },
      {
        key: 'stock',
        header: 'Stok',
        sortable: true,
        numeric: true,
        width: '80px',
        sortValue: line => stockOverrides[line.variantId] ?? line.currentStock,
        cell: line => stockOverrides[line.variantId] ?? line.currentStock,
      },
      {
        key: 'daily',
        header: 'Günlük Satış',
        sortable: true,
        numeric: true,
        width: '112px',
        sortValue: line => line.dailyAvg,
        cell: line => line.dailyAvg.toLocaleString('tr-TR'),
      },
      {
        key: 'reorder',
        header: 'Sipariş Noktası',
        sortable: true,
        numeric: true,
        width: '128px',
        sortValue: line => (line.needsOrder ? line.reorderPoint : null),
        cell: line => (line.needsOrder ? line.reorderPoint : <span className="text-muted-foreground">—</span>),
      },
      {
        // Adet: sepetteki adet basılır; öneriden sapmışsa öneri soluk not olur.
        key: 'qty',
        header: 'Adet',
        sortable: true,
        numeric: true,
        width: '104px',
        sortValue: line => {
          if (line.variantId in basket) return basket[line.variantId];
          return line.needsOrder ? line.suggestedQty : null;
        },
        cell: line => {
          const inBasket = line.variantId in basket;
          const qty = basket[line.variantId];
          if (inBasket) {
            return (
              <>
                {qty}
                {line.needsOrder && qty !== line.suggestedQty && (
                  <span className="ml-1 text-xs text-muted-foreground print:hidden" title="Sistem önerisi">
                    öneri {line.suggestedQty}
                  </span>
                )}
              </>
            );
          }
          return line.needsOrder ? line.suggestedQty : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        key: 'unit',
        header: 'Birim',
        sortable: true,
        numeric: true,
        width: '104px',
        cellClassName: line => (line.isEstimate ? 'cursor-help' : undefined),
        sortValue: line => line.unitCost,
        cell: line => (
          <span title={line.isEstimate ? 'Alış fiyatı tanımlı değil; satış fiyatı kullanıldı' : undefined}>
            {formatPrice(line.unitCost)}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Tutar',
        sortable: true,
        numeric: true,
        width: '120px',
        sortValue: line => (line.variantId in basket ? basket[line.variantId] * line.unitCost : null),
        cell: line =>
          line.variantId in basket ? formatPrice(basket[line.variantId] * line.unitCost) : <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">İşlem</span>,
        align: 'right',
        width: '104px',
        printHidden: true,
        cell: line => {
          if (!token) return null;
          const inBasket = line.variantId in basket;
          return (
            <RowActions>
              {vendor.vendorId === null && (
                <VendorAssignPopover token={token} productId={line.productId} vendors={vendors} onAssigned={onAssigned} />
              )}
              {(line.needsOrder || inBasket) && (
                <QuickStockButton
                  token={token}
                  productId={line.productId}
                  variantId={line.variantId}
                  addQty={basket[line.variantId] ?? line.suggestedQty}
                  onStockChange={onStockChange}
                />
              )}
            </RowActions>
          );
        },
      },
    ],
    [basket, stockOverrides, token, vendors, vendor.vendorId, onAssigned, onStockChange],
  );

  return (
    <Table
      data={vendor.lines}
      columns={columns}
      getRowId={line => line.variantId}
      rowHeight={49}
      selectable
      selectedRowIds={selectedRowIds}
      onSelectionChange={handleSelectionChange}
      selectionLabel={line => `${line.productName} sepete ekle`}
      selectAllLabel="Hepsini seç"
      selectAllTitle={state =>
        state === 'mixed'
          ? 'Kısmi seçim — tümünü seçmek için tıkla'
          : state
            ? 'Tüm satırlar sepette — kaldırmak için tıkla'
            : 'Tümünü sepete ekle'
      }
      // Sepette olmayan satırlar çıktı (sipariş listesi) dışında kalır.
      rowState={line => ({
        className: cn('print:bg-transparent', !(line.variantId in basket) && 'print:hidden'),
      })}
      cellClassName="print:border-neutral-400"
    />
  );
}
