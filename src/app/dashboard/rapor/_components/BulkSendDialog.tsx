'use client';

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PaperAirplaneIcon } from '@/components/ui/icons/paper-airplane';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { BasketLine } from './basket';

export interface BulkSendGroup {
  vendor: PurchaseReportVendor;
  lines: BasketLine[];
  email: string | null;
}

interface BulkSendDialogProps {
  token: string;
  /** Sepette satırı olan gerçek (vendorId !== null) tedarikçi grupları. */
  groups: BulkSendGroup[];
  /** Her başarılı gönderimde o tedarikçinin satırları sepetten düşer. */
  onVendorSent: (vendorId: string) => void;
}

/**
 * Sepetin tamamını sipariş etme: her tedarikçiye KENDİ sepet satırlarıyla
 * ayrı bir e-posta gider (tek toplu e-posta yok — alıcılar farklı).
 * Gönderimler sırayla yapılır; e-postası olmayan tedarikçi atlanır ve
 * önizlemede öyle işaretlenir.
 */
export function BulkSendDialog({ token, groups, onVendorSent }: BulkSendDialogProps) {
  const { ref: sendRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const ready = groups.filter(g => g.email);
  const skipped = groups.filter(g => !g.email);
  const readyTotal = ready.reduce(
    (sum, g) => sum + g.lines.reduce((s, { line, qty }) => s + qty * line.unitCost, 0),
    0,
  );

  const sendAll = async () => {
    setSending(true);
    const sent: string[] = [];
    const failed: string[] = [];
    for (const group of ready) {
      const vendorId = group.vendor.vendorId!;
      setProgress(group.vendor.vendorName);
      try {
        await ApiRequests.vendors.sendReport(token, {
          vendorId,
          lines: group.lines.map(({ line, qty }) => ({ variantId: line.variantId, qty })),
        });
        sent.push(group.vendor.vendorName);
        onVendorSent(vendorId);
      } catch (error) {
        logger.error('Bulk vendor report send failed', { vendorId, error });
        failed.push(group.vendor.vendorName);
      }
    }
    setSending(false);
    setProgress(null);
    setOpen(false);
    if (sent.length > 0) toast.success(`${sent.length} tedarikçiye sipariş gönderildi`);
    if (failed.length > 0) toast.error(`Gönderilemedi: ${failed.join(', ')}`);
  };

  return (
    <Dialog open={open} onOpenChange={next => !sending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 w-full gap-1.5 text-xs tabular-nums"
          disabled={ready.length === 0}
          title={
            ready.length === 0
              ? groups.length === 0
                ? 'Sepet boş'
                : 'Tedarikçi e-postaları eksik'
              : undefined
          }
          aria-label="Tüm tedarikçilere sipariş e-postalarını gönder"
          {...hoverProps}
        >
          <PaperAirplaneIcon ref={sendRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
          Hepsini Sipariş Ver · {ready.length} tedarikçi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hepsini sipariş ver</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Her tedarikçiye kendi sipariş e-postası ayrı gönderilir.
        </p>
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
          {groups.map(({ vendor, lines, email }) => {
            const total = lines.reduce((s, { line, qty }) => s + qty * line.unitCost, 0);
            const isSending = sending && progress === vendor.vendorName;
            return (
              <li key={vendor.vendorId} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{vendor.vendorName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {email ?? 'E-posta yok — atlanacak'}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="text-foreground">
                    {lines.length} kalem · {formatPrice(total)}
                  </p>
                  {isSending && <p className="text-xs text-muted-foreground">Gönderiliyor…</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Gönderilecek toplam · {ready.length} e-posta</span>
          <span className="font-semibold tabular-nums text-foreground">{formatPrice(readyTotal)}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Vazgeç
          </Button>
          <Button type="button" onClick={sendAll} disabled={sending || ready.length === 0}>
            {sending ? `Gönderiliyor… (${progress})` : `Gönder (${ready.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
