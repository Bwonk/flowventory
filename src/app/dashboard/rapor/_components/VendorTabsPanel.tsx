'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { AddProductsDialog } from './AddProductsDialog';
import { vendorBasketTotals, type BasketState } from './basket';
import { DeleteVendorDialog } from './DeleteVendorDialog';
import { VendorActionBar } from './VendorActionBar';
import { VendorOrderTable } from './VendorOrderTable';

/** Tab/print anahtarı — printVendorId ile aynı konvansiyon. */
export function vendorKey(vendor: PurchaseReportVendor): string {
  return vendor.vendorId ?? 'none';
}

interface VendorTabsPanelProps {
  vendors: PurchaseReportVendor[];
  token: string | null;
  vendorList: VendorListItem[];
  stockOverrides: Record<string, number>;
  onStockChange: (variantId: string, newTotalStock: number) => void;
  /** Sepet: tikli satırlar ve adetleri; gönderim/yazdırma sepeti izler. */
  basket: BasketState;
  onLineQtyChange: (variantId: string, qty: number | null) => void;
  /** Gönderim başarısında o tedarikçinin satırları sepetten düşer. */
  onVendorSent: (vendorId: string) => void;
  onAssigned: () => Promise<void>;
  /** Ürün Ekle sonrası refetch + aktif tab'ı tedarikçi adıyla yeniden hedefleme
      (local- id ilk atamada gerçek ikas id'sine dönüşür, tab zıplamasın). */
  onProductsAssigned: (vendorName: string) => Promise<void>;
  onVendorContactSaved: (vendorId: string, next: { email: string | null; phone: string | null }) => void;
  /** Ürünsüz tedarikçi silindiğinde sayfa listesinden düşürülür. */
  onVendorDeleted: (vendorId: string) => void;
  activeKey: string | null;
  onActiveKeyChange: (key: string) => void;
  printVendorId: string | null;
  onPrintVendor: (key: string) => void;
}

/**
 * Tedarikçi tab'lı sipariş paneli. Tab yolu (kayan hap) ve tedarikçi işlem
 * yolu kartın üstünde yüzer; kart düz hairline dikdörtgendir. Tüm paneller
 * DOM'da kalır: ekranda `hidden` gizler, print'te `print:block` bunu ezerek
 * global yazdırmada sepetinde satır olan tüm tedarikçileri sırayla çıktıya sokar.
 */
export function VendorTabsPanel({
  vendors,
  token,
  vendorList,
  stockOverrides,
  onStockChange,
  basket,
  onLineQtyChange,
  onVendorSent,
  onAssigned,
  onProductsAssigned,
  onVendorContactSaved,
  onVendorDeleted,
  activeKey,
  onActiveKeyChange,
  printVendorId,
  onPrintVendor,
}: VendorTabsPanelProps) {
  const reduceMotion = useReducedMotion();
  // Maliyet desc, maliyetsizler ada göre (henüz ürünsüz yeni kayıtlar da
  // araya girer); "Tedarikçi atanmamış" (vendorId null) sona pinlenir.
  const orderedVendors = [
    ...vendors
      .filter(v => v.vendorId !== null)
      .sort((a, b) => b.totalCost - a.totalCost || a.vendorName.localeCompare(b.vendorName, 'tr')),
    ...vendors.filter(v => v.vendorId === null),
  ];

  const effectiveActiveKey =
    orderedVendors.length > 0 &&
    activeKey !== null &&
    orderedVendors.some(v => vendorKey(v) === activeKey)
      ? activeKey
      : orderedVendors.length > 0
        ? vendorKey(orderedVendors[0])
        : null;

  // İçerik geçişi (DESIGN.md §6): hap anında kayar; eski içerik 100ms söner,
  // yeni tedarikçi 150ms belirir. Yatay kayma yok — tablo ağır, kayma gürültü.
  const [shownKey, setShownKey] = useState(effectiveActiveKey);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (shownKey === effectiveActiveKey) return;
    if (reduceMotion) {
      setShownKey(effectiveActiveKey);
      return;
    }
    setFading(true);
    const timer = setTimeout(() => {
      setShownKey(effectiveActiveKey);
      setFading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [effectiveActiveKey, shownKey, reduceMotion]);

  if (orderedVendors.length === 0 || effectiveActiveKey === null) return null;

  const activeVendor =
    orderedVendors.find(v => vendorKey(v) === effectiveActiveKey) ?? orderedVendors[0];
  const shownVendorKey = orderedVendors.some(v => vendorKey(v) === shownKey)
    ? (shownKey as string)
    : effectiveActiveKey;
  const activeContact = vendorList.find(v => v.vendorId === activeVendor.vendorId);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
        <SegmentedTrack
          role="tablist"
          aria-label="Tedarikçiler"
          value={effectiveActiveKey}
          onChange={onActiveKeyChange}
          className="flex-1"
          options={orderedVendors.map(vendor => {
            const urgentCount = vendor.lines.filter(line => line.urgent).length;
            return {
              value: vendorKey(vendor),
              // Dar yolda uzun adlar tek satırı bozmasın
              label: (
                <span className="max-w-36 truncate">
                  {vendor.vendorId === null ? 'Tedarikçi atanmamış' : vendor.vendorName}
                </span>
              ),
              badge: urgentCount > 0 ? <Badge variant="critical">{urgentCount}</Badge> : undefined,
            };
          })}
        />

        {/* Tedarikçi işlem yolu — aktif tedarikçi; kompakt ikonlar, hover'da etiket */}
        <VendorActionBar
          token={token}
          vendor={activeVendor}
          contact={activeContact ?? { email: null, phone: null }}
          basket={basket}
          onPrint={() => onPrintVendor(effectiveActiveKey)}
          onProductsAssigned={onProductsAssigned}
          onContactSaved={onVendorContactSaved}
          onSent={onVendorSent}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline bg-card print:border-neutral-400">
        <div
          className={cn(
            'transition-opacity print:opacity-100',
            fading ? 'opacity-0 duration-100' : 'opacity-100 duration-150',
          )}
        >
          {orderedVendors.map(vendor => {
            const key = vendorKey(vendor);
            const vendorTotals = vendorBasketTotals(vendor, basket);
            const isShown = key === shownVendorKey;
            // Print'te sepetinde satır olan ve (global yazdırmada ya da seçili
            // tedarikçi yazdırmada) hedeflenen içerik açılır.
            const printable =
              vendorTotals.count > 0 && (printVendorId === null || printVendorId === key);
            return (
              <div
                key={key}
                role="tabpanel"
                aria-label={vendor.vendorName}
                className={cn(
                  isShown ? 'block' : 'hidden',
                  printable ? 'print:block print:break-inside-avoid' : 'print:hidden',
                )}
              >
                {/* Ekran tab yolunun print karşılığı: tedarikçi başlığı + toplam */}
                <div className="hidden items-baseline justify-between border-b border-border px-5 py-3 print:flex print:border-neutral-400">
                  <h2 className="text-sm font-medium text-foreground">{vendor.vendorName}</h2>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {vendorTotals.count} kalem · {formatPrice(vendorTotals.total)}
                    {vendorTotals.hasEstimate && ' tahmini'}
                  </p>
                </div>
                {vendor.lines.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center print:hidden">
                    <p className="text-sm font-medium text-foreground">Bu tedarikçiye henüz ürün atanmadı</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Ürün eklediğinizde tedarikçi ikas&apos;a da kaydedilir; sipariş önerileri bu tab&apos;da
                      listelenir.
                    </p>
                    {token && (
                      <div className="flex items-center gap-2">
                        <AddProductsDialog
                          token={token}
                          vendorName={vendor.vendorName}
                          onAssigned={() => onProductsAssigned(vendor.vendorName)}
                        />
                        {vendor.vendorId !== null && (
                          <DeleteVendorDialog
                            token={token}
                            vendorId={vendor.vendorId}
                            vendorName={vendor.vendorName}
                            onDeleted={onVendorDeleted}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <VendorOrderTable
                    vendor={vendor}
                    token={token}
                    vendors={vendorList}
                    stockOverrides={stockOverrides}
                    onStockChange={onStockChange}
                    onAssigned={onAssigned}
                    basket={basket}
                    onLineQtyChange={onLineQtyChange}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
