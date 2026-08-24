'use client';

import { ExpandableActionBar, type ExpandableActionBarItem } from '@/components/motion/expandable-action-bar';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { AdjustmentsHorizontalIcon } from '@/components/ui/icons/adjustments-horizontal';
import { ArrowPathIcon } from '@/components/ui/icons/arrow-path';
import { PlusIcon } from '@/components/ui/icons/plus';
import { PrinterIcon } from '@/components/ui/icons/printer';
import { ShoppingCartIcon } from '@/components/ui/icons/shopping-cart';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import { AddVendorDialog } from './AddVendorDialog';
import { BasketSheet } from './BasketSheet';
import { basketTotals, type BasketState } from './basket';
import { ReportParamsPopover } from './ReportParamsPopover';

interface ReportActionBarProps {
  token: string | null;
  leadTimeDays: number;
  targetStockDays: number;
  onApplySettings: (leadTimeDays: number, targetStockDays: number) => Promise<void>;
  onVendorCreated: (vendor: VendorListItem) => void;
  onRefresh: () => void;
  vendors: PurchaseReportVendor[];
  vendorList: VendorListItem[];
  basket: BasketState;
  onLineQtyChange: (variantId: string, qty: number | null) => void;
  onResetBasket: () => void;
  onVendorSent: (vendorId: string) => void;
  onPrint: () => void;
}

/**
 * Sayfa araçları — kompakt ikon yolu, hover/focus'ta etiketler açılır
 * (DESIGN.md §5 "Araç yolu"). Dialog/popover/sheet tetikleyicileri yol
 * butonlarına `asChild` ile biner; ikon animasyonları butondan sürülür.
 */
export function ReportActionBar({
  token,
  leadTimeDays,
  targetStockDays,
  onApplySettings,
  onVendorCreated,
  onRefresh,
  vendors,
  vendorList,
  basket,
  onLineQtyChange,
  onResetBasket,
  onVendorSent,
  onPrint,
}: ReportActionBarProps) {
  const params = useIconHover();
  const addVendor = useIconHover();
  const refresh = useIconHover();
  const cart = useIconHover();
  const print = useIconHover();
  const totals = basketTotals(vendors, basket);
  const basketEmpty = Object.keys(basket).length === 0;

  const items: ExpandableActionBarItem[] = [
    {
      id: 'params',
      icon: <AdjustmentsHorizontalIcon ref={params.ref} size={12} className="flex" aria-hidden />,
      // Etiket veri: mevcut tedarik süresi · hedef stok günü.
      label: (
        <span className="font-mono text-xs tabular-nums">
          {leadTimeDays}g · {targetStockDays}g
        </span>
      ),
      title: 'Hesap parametreleri',
      'aria-label': 'Hesap parametreleri',
      hoverProps: params.hoverProps,
      wrap: button => (
        <ReportParamsPopover
          leadTimeDays={leadTimeDays}
          targetStockDays={targetStockDays}
          onApply={onApplySettings}
          trigger={button}
        />
      ),
    },
    ...(token
      ? [
          {
            id: 'add-vendor',
            icon: <PlusIcon ref={addVendor.ref} size={12} className="flex" aria-hidden />,
            label: 'Tedarikçi ekle',
            hoverProps: addVendor.hoverProps,
            wrap: button => <AddVendorDialog token={token} onCreated={onVendorCreated} trigger={button} />,
          } satisfies ExpandableActionBarItem,
        ]
      : []),
    {
      id: 'refresh',
      icon: <ArrowPathIcon ref={refresh.ref} size={12} className="flex" aria-hidden />,
      label: 'Yenile',
      hoverProps: refresh.hoverProps,
      onClick: onRefresh,
    },
    {
      id: 'basket',
      icon: <ShoppingCartIcon ref={cart.ref} size={12} className="flex" aria-hidden />,
      label: 'Sepet',
      'aria-label': `Sepet, ${totals.count} kalem`,
      badge: totals.count > 0 ? <AnimatedNumber value={totals.count} /> : undefined,
      hoverProps: cart.hoverProps,
      wrap: button => (
        <BasketSheet
          token={token}
          vendors={vendors}
          vendorList={vendorList}
          basket={basket}
          onLineQtyChange={onLineQtyChange}
          onResetBasket={onResetBasket}
          onVendorSent={onVendorSent}
          trigger={button}
        />
      ),
    },
    {
      id: 'print',
      icon: <PrinterIcon ref={print.ref} size={12} className="flex" aria-hidden />,
      label: 'Yazdır / PDF',
      // Yolun sağ ucunda öne çıkan bg-card hap; ink birincil tedarikçi yolundaki Gönder'dir.
      variant: 'card',
      separatorBefore: true,
      disabled: basketEmpty,
      title: basketEmpty ? 'Sepet boş' : undefined,
      hoverProps: print.hoverProps,
      onClick: onPrint,
    },
  ];

  // Yolun AÇIK genişliği kadar alan rezerve edilir (5 etiketli öğe ≈ 535px):
  // kapalı yol bu alanın sağında durur, açılınca (overlay) yalnız boş alanı
  // doldurur — başlık/açıklama metninin üstüne gelmez; başlığın satır kırma
  // kararı da açılıp kapanmakla değişmediği için sayfa zıplamaz. Daha dar
  // içerikte PageHeader'ın flex-wrap'i bu alanı kendi satırına indirir.
  return (
    <div className="flex w-[34rem] max-w-full justify-end print:hidden">
      <ExpandableActionBar items={items} overlay aria-label="Rapor işlemleri" />
    </div>
  );
}
