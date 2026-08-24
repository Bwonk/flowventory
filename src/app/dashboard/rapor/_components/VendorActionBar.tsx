'use client';

import { ExpandableActionBar, type ExpandableActionBarItem } from '@/components/motion/expandable-action-bar';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { PaperAirplaneIcon } from '@/components/ui/icons/paper-airplane';
import { PlusIcon } from '@/components/ui/icons/plus';
import { PrinterIcon } from '@/components/ui/icons/printer';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import { AddProductsDialog } from './AddProductsDialog';
import { vendorBasketLines, vendorBasketTotals, type BasketState } from './basket';
import { SendReportDialog } from './SendReportDialog';
import { VendorContactPopover } from './VendorContactPopover';

interface VendorActionBarProps {
  token: string | null;
  vendor: PurchaseReportVendor;
  contact: { email: string | null; phone: string | null };
  basket: BasketState;
  onPrint: () => void;
  onProductsAssigned: (vendorName: string) => Promise<void>;
  onContactSaved: (vendorId: string, next: { email: string | null; phone: string | null }) => void;
  onSent: (vendorId: string) => void;
}

/**
 * Aktif tedarikçinin işlem yolu — Ürün ekle · Yazdır · İletişim │ Gönder (ink).
 * Kompakt ikonlar hover/focus'ta etiketlenir; tek ink birincil sayfanın asıl
 * hedefi olan Gönder'dir. Yazdır/Gönder sepet boşken kapalıdır.
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
            icon: <EnvelopeIcon ref={mail.ref} size={12} className="flex" aria-hidden />,
            label: 'İletişim',
            'aria-label': `${vendor.vendorName} iletişim bilgileri`,
            hoverProps: mail.hoverProps,
            wrap: button => (
              <VendorContactPopover
                token={token}
                vendorId={vendorId}
                vendorName={vendor.vendorName}
                contact={contact}
                onSaved={next => onContactSaved(vendorId, next)}
                trigger={button}
              />
            ),
          } satisfies ExpandableActionBarItem,
          {
            id: 'send',
            icon: <PaperAirplaneIcon ref={send.ref} size={12} className="flex" aria-hidden />,
            label: 'Gönder',
            'aria-label': `${vendor.vendorName} siparişini e-posta ile gönder`,
            variant: 'ink',
            separatorBefore: true,
            disabled: !contact.email || sendLines.length === 0,
            title:
              sendLines.length === 0 ? 'Sepet boş' : contact.email ? undefined : "Önce İletişim'den e-posta ekleyin",
            hoverProps: send.hoverProps,
            wrap: button => (
              <SendReportDialog
                token={token}
                vendorId={vendorId}
                vendorName={vendor.vendorName}
                email={contact.email}
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
