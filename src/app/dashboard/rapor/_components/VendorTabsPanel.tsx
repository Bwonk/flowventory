'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PrinterIcon } from '@/components/ui/icons/printer';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { AddProductsDialog } from './AddProductsDialog';
import { vendorBasketLines, vendorBasketTotals, type BasketState } from './basket';
import { ConcaveFillet } from './ConcaveFillet';
import { DeleteVendorDialog } from './DeleteVendorDialog';
import { SendReportDialog } from './SendReportDialog';
import { VendorContactPopover } from './VendorContactPopover';
import { VendorOrderTable } from './VendorOrderTable';

/** Tab/print anahtarı — printVendorId ile aynı konvansiyon. */
export function vendorKey(vendor: PurchaseReportVendor): string {
  return vendor.vendorId ?? 'none';
}

// Yan kavisler paylaşılan ConcaveFillet'ten gelir — "Akışkan S" eğrisi
// sayfadaki tüm kavisli yüzeylerde (tab, aksiyon rafı, KPI rafı) tektir.

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
 * Tedarikçi tab'lı sipariş paneli. Tüm tab içerikleri forceMount ile DOM'da
 * kalır: ekranda Radix'in `hidden` attribute'u gizler, print'te `print:block`
 * bunu ezerek global yazdırmada öneri satırı olan tüm tedarikçileri sırayla
 * çıktıya sokar.
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
  const { ref: printRef, hoverProps: printHoverProps } = useIconHover();
  const reduceMotion = useReducedMotion();
  // Maliyet desc, maliyetsizler ada göre (henüz ürünsüz yeni kayıtlar da
  // araya girer); "Tedarikçi atanmamış" (vendorId null) sona pinlenir.
  const orderedVendors = [
    ...vendors
      .filter(v => v.vendorId !== null)
      .sort((a, b) => b.totalCost - a.totalCost || a.vendorName.localeCompare(b.vendorName, 'tr')),
    ...vendors.filter(v => v.vendorId === null),
  ];
  if (orderedVendors.length === 0) return null;

  const effectiveActiveKey =
    activeKey !== null && orderedVendors.some(v => vendorKey(v) === activeKey)
      ? activeKey
      : vendorKey(orderedVendors[0]);
  const activeVendor =
    orderedVendors.find(v => vendorKey(v) === effectiveActiveKey) ?? orderedVendors[0];

  const activeBasketCount = vendorBasketTotals(activeVendor, basket).count;

  // İlk tab kartın sol kenarına hizalı; aktifken kartın sol üst köşesi
  // düzleşir ki tab'ın sol kenarlığı kesintisiz aşağı aksın. Başka tab
  // aktifken köşe yuvarlak kalır (ilk tab o an yüzeysiz, salt metin).
  const firstTabActive = vendorKey(orderedVendors[0]) === effectiveActiveKey;

  return (
    <section>
      <Tabs value={effectiveActiveKey} onValueChange={onActiveKeyChange} className="gap-0">
        {/* Ray kanvas üzerinde yaşar: aktif tab ve aksiyon rafı karta kaynaşık
            (çentikli panel motifi — KPI panelindeki rafla aynı dil). */}
        <div className="flex items-end justify-between gap-3 print:hidden">
          <TabsList
            variant="line"
            // pl-0: ilk tab kartın sol kenarıyla tam hizalı — aktifken sol
            // kenarlığı kartın sol kenarlığını yukarı sürdürür (aksiyon
            // rafının sağ kenarındaki desenin aynası).
            // flex-nowrap + overflow-x-auto: dar alanda (ikas admin iframe'i)
            // tab'lar alt satıra KIRILMAZ — ray tek satırda kalır ve yatay
            // kayar; kırılma kaynaşık tab yüzeyini karttan koparıyordu.
            // Scrollbar gizli: ray çizgisi kesintisiz okunur.
            className="relative z-10 -mb-px min-w-0 flex-1 flex-nowrap items-stretch justify-start gap-3 overflow-x-auto p-0 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden group-data-[orientation=horizontal]/tabs:h-auto"
            aria-label="Tedarikçiler"
          >
            {orderedVendors.map((vendor, index) => {
              const urgentCount = vendor.lines.filter(line => line.urgent).length;
              const isTabActive = vendorKey(vendor) === effectiveActiveKey;
              const isFirstTab = index === 0;
              return (
                <TabsTrigger
                  key={vendorKey(vendor)}
                  value={vendorKey(vendor)}
                  // border-0 şart: base'in görünmez `border border-transparent`ı
                  // absolute yüzey/kavis katmanlarının %100 tabanını padding
                  // kutusuna küçültüp kartla arada 1px dikiş bırakıyordu.
                  // h-9: aksiyon rafıyla AYNI yükseklik (raf da h-9) — ayrıca
                  // kesirli içerik yüksekliği üst kenarlığı piksel ızgarasından
                  // kaydırıp bulanık gösteriyordu, sabit tam sayı bunu da çözer.
                  // z yükseltmesi bilinçli yok: sağ kavis komşu tab'ın altına
                  // girer, sonraki kardeşin metni üstte boyanır (Safari sekmesi).
                  className="h-9 flex-none gap-1.5 rounded-none border-0 px-4 after:hidden"
                >
                  {/* Aktif tab yüzeyi: bg + kenarlıklar ayrı katmanda —
                      trigger'ın variant sınıflarıyla (bg-background vb.)
                      specificity yarışına girmez. Üst köşeler kart radius
                      diliyle (rounded-t-lg), alt kenar -mb-px bindirmesiyle
                      kartla kaynaşık. layoutId: tab değişince yüzey eski
                      tab'dan yenisine kayar (onboarding hap morph'uyla aynı
                      spring — DESIGN.md hareket dili). */}
                  {isTabActive && (
                    <>
                      <motion.span
                        aria-hidden
                        layoutId="vendor-tab-surface"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 350, damping: 35 }
                        }
                        className={cn(
                          'absolute inset-0 border-t border-hairline bg-card',
                          // Üst radius yok — üst köşeleri S-kavislerin yatay
                          // teğetleri çizer. Yalnız en soldaki tab kartın sol
                          // kenarını düz sürdürür ve köşesini kart dilinde
                          // yuvarlar (aksiyon rafının sağ kenarının aynası).
                          isFirstTab && 'rounded-tl-lg border-l',
                        )}
                      >
                        {/* Sağ S-kavis motion katmanının içinde — kayma
                            animasyonunda yüzeyle birlikte taşınır. */}
                        <ConcaveFillet side="right" />
                      </motion.span>
                      {!isFirstTab && (
                        // Sol S-kavis yüzeyin dışında: -z-10 ile soldaki
                        // komşunun metni üstte kalır (sağda aynı işi DOM
                        // sırası görür). Yüzey kayarken hedefte yumuşak fade
                        // ile belirir; ilk tab'a dönüşte düz kenar devralır.
                        <motion.span
                          aria-hidden
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay: 0.08 }}
                          // top-0 + h-full (ekstra piksel YOK): sarmalayıcının
                          // ebeveyni border'sız trigger — surface içindeki sağ
                          // kavisin aksine padding-box kayması yoktur; -top-px
                          // kullanmak kavisi 1px yukarı bindirip üst çizgiyi
                          // kalınlaştırıyordu.
                          className="pointer-events-none absolute top-0 -left-[30px] -z-10 h-full w-[30px]"
                        >
                          {/* Sarmalayıcı konumu üstlendi — svg içeride sıfırlanır. */}
                          <ConcaveFillet side="left" className="left-0 top-0! h-full!" />
                        </motion.span>
                      )}
                    </>
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {/* Dar rayda uzun adlar tek satırı bozmasın */}
                    <span className="max-w-36 truncate">
                      {vendor.vendorId === null ? 'Tedarikçi atanmamış' : vendor.vendorName}
                    </span>
                    {urgentCount > 0 && <Badge variant="critical">{urgentCount}</Badge>}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Aksiyon rafı — aktif tedarikçi; KPI panelindeki rafın ikizi */}
          {/* h-9: tab'larla aynı yükseklik — ray tek hizada okunur. Sol kavis
              tab'larla AYNI Akışkan S eğrisi (aynı genişlik ve kontrol
              noktaları) — ray boyunca tek eğri dili. */}
          <div className="relative z-10 -mb-px flex h-9 shrink-0 items-center gap-1 rounded-tr-lg border-t border-r border-hairline bg-card px-2"><ConcaveFillet side="left" />
            {token && activeVendor.vendorId !== null && (
              <AddProductsDialog
                token={token}
                vendorName={activeVendor.vendorName}
                onAssigned={() => onProductsAssigned(activeVendor.vendorName)}
                compact
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPrintVendor(effectiveActiveKey)}
              className="h-6 gap-1 px-2 text-xs"
              disabled={activeBasketCount === 0}
              title={activeBasketCount === 0 ? 'Sepet boş' : undefined}
              aria-label={`${activeVendor.vendorName} siparişini yazdır`}
              {...printHoverProps}
            >
              <PrinterIcon ref={printRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
              Yazdır
            </Button>
            {token && activeVendor.vendorId !== null && (
              <VendorContactPopover
                token={token}
                vendorId={activeVendor.vendorId}
                vendorName={activeVendor.vendorName}
                contact={
                  vendorList.find(v => v.vendorId === activeVendor.vendorId) ?? {
                    email: null,
                    phone: null,
                  }
                }
                onSaved={next => onVendorContactSaved(activeVendor.vendorId!, next)}
              />
            )}
            {token && activeVendor.vendorId !== null && (
              <SendReportDialog
                token={token}
                vendorId={activeVendor.vendorId}
                vendorName={activeVendor.vendorName}
                email={vendorList.find(v => v.vendorId === activeVendor.vendorId)?.email ?? null}
                lines={vendorBasketLines(activeVendor, basket)}
                onSent={() => onVendorSent(activeVendor.vendorId!)}
              />
            )}
          </div>
        </div>

        {/* Tablo kartı — sağ üst köşesi aksiyon rafına devrolur */}
        <div
          className={cn(
            'overflow-hidden rounded-lg rounded-tr-none border border-hairline bg-card print:rounded-lg print:border-neutral-400',
            firstTabActive && 'rounded-tl-none',
          )}
        >
        {orderedVendors.map(vendor => {
          const vendorTotals = vendorBasketTotals(vendor, basket);
          const isActive = vendorKey(vendor) === effectiveActiveKey;
          // forceMount'ta Radix `hidden` attribute'u BASMAZ (present hep true) —
          // ekran gizlemesi bizde. Print'te ise sepetinde satır olan ve (global
          // yazdırmada ya da seçili tedarikçi yazdırmada) hedeflenen içerik açılır.
          const printable =
            vendorTotals.count > 0 && (printVendorId === null || printVendorId === vendorKey(vendor));
          return (
            <TabsContent
              key={vendorKey(vendor)}
              value={vendorKey(vendor)}
              forceMount
              className={cn(
                isActive ? 'block' : 'hidden',
                printable ? 'print:block print:break-inside-avoid' : 'print:hidden',
              )}
            >
              {/* Ekran tab rayının print karşılığı: tedarikçi başlığı + toplam */}
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
            </TabsContent>
          );
        })}
        </div>
      </Tabs>
    </section>
  );
}
