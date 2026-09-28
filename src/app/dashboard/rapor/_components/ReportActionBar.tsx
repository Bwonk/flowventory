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
import { ArchiveBoxArrowDownIcon } from '@/components/ui/icons/archive-box-arrow-down';
import { IncomingSheet } from './IncomingSheet';

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
  onVendorContactSaved: (vendorId: string, next: { email: string | null; phone: string | null }) => void;
  /** Açık (gönderilmiş / kısmi) sipariş sayısı — Yolda rozeti. */
  openOrderCount: number;
  /** Yolda çekmecesinde teslim alma / iptal / geri al sonrası. */
  onOrdersChanged: () => void;
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
  onVendorContactSaved,
  openOrderCount,
  onOrdersChanged,
  onPrint,
}: ReportActionBarProps) {
  const params = useIconHover();
  const addVendor = useIconHover();
  const refresh = useIconHover();
  const cart = useIconHover();
  const incoming = useIconHover();
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
      label: 'Taslaklar',
      'aria-label': `Taslaklar, ${totals.count} kalem`,
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
          onVendorContactSaved={onVendorContactSaved}
          trigger={button}
        />
      ),
    },
    {
      id: 'incoming',
      icon: <ArchiveBoxArrowDownIcon ref={incoming.ref} size={12} className="flex" aria-hidden />,
      label: 'Yolda',
      'aria-label': `Yolda, ${openOrderCount} açık sipariş`,
      badge: openOrderCount > 0 ? <AnimatedNumber value={openOrderCount} /> : undefined,
      hoverProps: incoming.hoverProps,
      wrap: button => <IncomingSheet token={token} onChanged={onOrdersChanged} trigger={button} />,
    },
    {
      id: 'print',
      icon: <PrinterIcon ref={print.ref} size={12} className="flex" aria-hidden />,
      label: 'Yazdır / PDF',
      // Yolun sağ ucunda texture secondary; primary (ink) tedarikçi yolundaki Gönder'dir.
      variant: 'card',
      separatorBefore: true,
      disabled: basketEmpty,
      title: basketEmpty ? 'Sepet boş' : undefined,
      hoverProps: print.hoverProps,
      onClick: onPrint,
    },
  ];

  // overlay: başlık satırı flex-wrap — açılan yol satırı kırıp sayfayı zıplatmasın.
  return <ExpandableActionBar items={items} overlay aria-label="Rapor işlemleri" className="print:hidden" />;
}
