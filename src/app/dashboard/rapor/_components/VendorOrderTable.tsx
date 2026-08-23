'use client';

import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { AnimatedCheckbox } from './AnimatedCheckbox';
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

/** Tek tedarikçinin sipariş önerisi tablosu; tab panelinin içeriği. */
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
  const checkedCount = vendor.lines.filter(line => line.variantId in basket).length;
  const allChecked = checkedCount === vendor.lines.length && vendor.lines.length > 0;
  const headerState: boolean | 'mixed' = allChecked ? true : checkedCount > 0 ? 'mixed' : false;

  // Hepsi tikliyse hepsini çıkar; hiçbiri/kısmi ise eksikleri varsayılanla ekle.
  const toggleAll = () => {
    for (const line of vendor.lines) {
      if (allChecked) onLineQtyChange(line.variantId, null);
      else if (!(line.variantId in basket)) onLineQtyChange(line.variantId, defaultQtyFor(line));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground print:border-neutral-400">
            {/* Ekranda kutucuk + "Hepsini seç"; print'te sütun adı "Ürün" kalır. */}
            <th colSpan={2} className="py-2 pl-5 pr-3 font-normal">
              <span className="flex items-center gap-2.5">
                <span className="print:hidden">
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
                </span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground print:hidden"
                >
                  Hepsini seç
                </button>
                <span className="hidden print:inline">Ürün</span>
              </span>
            </th>
            <th className="px-3 py-2 font-normal">SKU</th>
            <th className="px-3 py-2 text-right font-normal">Stok</th>
            <th className="px-3 py-2 text-right font-normal">Günlük Satış</th>
            <th className="px-3 py-2 text-right font-normal">Sipariş Noktası</th>
            <th className="px-3 py-2 text-right font-normal">Adet</th>
            <th className="px-3 py-2 text-right font-normal">Birim</th>
            <th className="px-5 py-2 text-right font-normal">Tutar</th>
            <th className="py-2 pl-3 pr-5 font-normal print:hidden">
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vendor.lines.map(line => {
            const inBasket = line.variantId in basket;
            const qty = basket[line.variantId];
            return (
              <tr
                key={line.variantId}
                className={cn(
                  'group border-b border-border last:border-b-0 print:border-neutral-400',
                  // Sepette olmayan satırlar çıktı (sipariş listesi) dışında kalır.
                  !inBasket && 'print:hidden',
                )}
              >
                <td className="w-10 py-2.5 pl-5 pr-0 print:hidden">
                  <AnimatedCheckbox
                    checked={inBasket}
                    onToggle={() => onLineQtyChange(line.variantId, inBasket ? null : defaultQtyFor(line))}
                    label={`${line.productName} sepete ekle`}
                  />
                </td>
                <td className="px-3 py-2.5">
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
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{line.sku ?? '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {stockOverrides[line.variantId] ?? line.currentStock}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{line.dailyAvg.toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {line.needsOrder ? line.reorderPoint : '—'}
                </td>
                {/* Adet: sepetteki adet basılır; öneriden sapmışsa öneri soluk not olur.
                    Düzenleme sepet çekmecesinde — tablo yalnız ekle/çıkar. */}
                <td className="px-3 py-2.5 text-right tabular-nums">
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
                </td>
                <td
                  className="px-3 py-2.5 text-right tabular-nums"
                  title={line.isEstimate ? 'Alış fiyatı tanımlı değil; satış fiyatı kullanıldı' : undefined}
                >
                  {formatPrice(line.unitCost)}
                </td>
                <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                  {inBasket ? (
                    formatPrice(qty * line.unitCost)
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 pl-3 pr-5 print:hidden">
                  {token && (
                    <div className="flex items-center justify-end gap-1.5">
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
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
