'use client';

import { ExpandableActionBar, type ExpandableActionBarItem } from '@/components/motion/expandable-action-bar';
import { Cog6ToothIcon } from '@/components/ui/icons/cog-6-tooth';
import { PaperAirplaneIcon } from '@/components/ui/icons/paper-airplane';
import { PlusIcon } from '@/components/ui/icons/plus';
import { PrinterIcon } from '@/components/ui/icons/printer';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import { AddProductsDialog } from './AddProductsDialog';
import { vendorBasketLines, vendorBasketTotals, type BasketState } from './basket';
import { SendReportDialog } from './SendReportDialog';
import { VendorContactPopover, type VendorSettings } from './VendorContactPopover';

interface VendorActionBarProps {
  token: string | null;
  vendor: PurchaseReportVendor;
  contact: {
    email: string | null;
    phone: string | null;
    leadTimeDays: number | null;
    moq: number | null;
    casePack: number | null;
  };
  basket: BasketState;
  onPrint: () => void;
  onProductsAssigned: (vendorName: string) => Promise<void>;
  onContactSaved: (vendorId: string, next: Partial<VendorSettings>) => void;
  onSent: (vendorId: string) => void;
  /** Tedarikçi ayarlarından silinince sayfa listesinden düşürür. */
  onVendorDeleted: (vendorId: string) => void;
}

/**
 * Aktif tedarikçinin işlem yolu — Ürün ekle · Tedarikçi ayarları · Yazdır │ Gönder (ink).
 * Kompakt ikonlar hover/focus'ta etiketlenir; tek ink birincil sayfanın asıl
 * hedefi olan Gönder'dir. Yazdır/Gönder yalnız sepet boşken kapalıdır —
 * e-posta eksikliği Gönder'i kapatmaz, pencere adresi sorar.
 */
export function VendorActionBar({
  token,
  vendor,
  contact,
  basket,
  onPrint,
  onProductsAssigned,
  onContactSaved,
  onSent,
  onVendorDeleted,
}: VendorActionBarProps) {
  const add = useIconHover();
  const print = useIconHover();
  const mail = useIconHover();
  const send = useIconHover();
  const vendorId = vendor.vendorId;
  const basketCount = vendorBasketTotals(vendor, basket).count;
  const sendLines = vendorBasketLines(vendor, basket);
  const canManage = token !== null && vendorId !== null;

  const items: ExpandableActionBarItem[] = [
    ...(canManage
      ? [
          {
            id: 'add-products',
            icon: <PlusIcon ref={add.ref} size={12} className="flex" aria-hidden />,
            label: 'Ürün ekle',
            'aria-label': `${vendor.vendorName} tedarikçisine ürün ekle`,
            hoverProps: add.hoverProps,
            wrap: button => (
              <AddProductsDialog
                token={token}
                vendorName={vendor.vendorName}
                onAssigned={() => onProductsAssigned(vendor.vendorName)}
                trigger={button}
              />
            ),
          } satisfies ExpandableActionBarItem,
        ]
      : []),
    {
      id: 'print',
      icon: <PrinterIcon ref={print.ref} size={12} className="flex" aria-hidden />,
      label: 'Yazdır',
      'aria-label': `${vendor.vendorName} siparişini yazdır`,
      disabled: basketCount === 0,
      title: basketCount === 0 ? 'Sepet boş' : undefined,
      hoverProps: print.hoverProps,
      onClick: onPrint,
    },
    ...(canManage
      ? [
          {
            id: 'contact',
            icon: <Cog6ToothIcon ref={mail.ref} size={12} className="flex" aria-hidden />,
            label: 'Tedarikçi ayarları',
            'aria-label': `${vendor.vendorName} iletişim ve tedarik ayarları`,
            hoverProps: mail.hoverProps,
            wrap: button => (
              <VendorContactPopover
                token={token}
                vendorId={vendorId}
                vendorName={vendor.vendorName}
                contact={contact}
                defaultLeadTimeDays={vendor.leadTimeDays}
                onSaved={next => onContactSaved(vendorId, next)}
                productCount={new Set(vendor.lines.map(l => l.productId)).size}
                onDeleted={onVendorDeleted}
                trigger={button}
              />
            ),
          } satisfies ExpandableActionBarItem,
          {
            id: 'send',
            icon: <PaperAirplaneIcon ref={send.ref} size={12} className="flex" aria-hidden />,
            label: 'Gönder',
            'aria-label': `${vendor.vendorName} siparişini gönder, ${sendLines.length} kalem`,
            badge: sendLines.length > 0 ? sendLines.length : undefined,
            variant: 'ink',
            separatorBefore: true,
            // E-posta eksikse de açık: pencere adresi sorar ve kaydeder.
            disabled: sendLines.length === 0,
            title: sendLines.length === 0 ? 'Sepet boş' : undefined,
            hoverProps: send.hoverProps,
            wrap: button => (
              <SendReportDialog
                token={token}
                vendorId={vendorId}
                vendorName={vendor.vendorName}
                contact={contact}
                leadTimeDays={vendor.leadTimeDays}
                onContactSaved={next => onContactSaved(vendorId, next)}
                lines={sendLines}
                onSent={() => onSent(vendorId)}
                variant="track"
                trigger={button}
              />
            ),
          } satisfies ExpandableActionBarItem,
        ]
      : []),
  ];

  // overlay: açılan yol sekmeleri sıkıştırmaz, üstlerine açılır (dar ekranda özellikle).
  return <ExpandableActionBar items={items} overlay aria-label={`${vendor.vendorName} işlemleri`} />;
}
