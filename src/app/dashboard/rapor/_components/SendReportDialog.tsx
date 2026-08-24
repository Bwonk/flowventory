'use client';

import { logger } from '@/lib/logger';
import { useState, type ReactNode } from 'react';
import { PaperAirplaneIcon } from '@/components/ui/icons/paper-airplane';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
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
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { BasketLine } from './basket';
import { extractErrorMessage } from './QuickStockButton';

interface SendReportDialogProps {
  token: string;
  vendorId: string;
  vendorName: string;
  /** Kayıtlı tedarikçi e-postası; yoksa buton disabled. */
  email: string | null;
  /** Sepetteki satırlar — e-postaya bu adetler gider. */
  lines: BasketLine[];
  /** Gönderim başarısında (sepetten düşürme vb.) — toast sonrası çağrılır. */
  onSent?: () => void;
  /** Tetik butonuna ek sınıf — ör. muted zeminde hover yüzeyini bg-card yapmak. */
  triggerClassName?: string;
  /**
   * Tetik görünümü: 'track' tedarikçi işlem yolundaki ink hap "Gönder";
   * 'group' sepet grubunun altındaki tam genişlik ink "Sipariş Ver" (tutar
   * hemen üstteki grup başlığında yazıyor, butonda tekrarlanmaz);
   * 'shelf' kompakt ghost (eski raf dili, sepet çekmecesi dışında kullanılmaz).
   */
  variant?: 'shelf' | 'group' | 'track';
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); disabled/title dışarıda hesaplanır. */
  trigger?: ReactNode;
}

/**
 * Tedarikçiye sipariş e-postası — dışa dönük aksiyon olduğu için tek tık
 * yerine bilinçli bir onay adımı var: alıcı + sepet satırları + toplam
 * gösterilir. Adetler sepetten gider; fiyat/isim sunucu raporundan okunur.
 */
export function SendReportDialog({
  token,
  vendorId,
  vendorName,
  email,
  lines,
  onSent,
  triggerClassName,
  variant = 'shelf',
  trigger,
}: SendReportDialogProps) {
  const { ref: sendRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const totalCost = lines.reduce((sum, { line, qty }) => sum + qty * line.unitCost, 0);
  const hasEstimate = lines.some(({ line }) => line.isEstimate);

  const send = async () => {
    setSending(true);
    try {
      const res = await ApiRequests.vendors.sendReport(token, {
        vendorId,
        lines: lines.map(({ line, qty }) => ({ variantId: line.variantId, qty })),
      });
      const data = res.data?.data;
      if (!data) throw new Error('Empty send-report response');
      setOpen(false);
      toast.success(`Gönderildi: ${data.sentTo}`);
      onSent?.();
    } catch (error) {
      logger.error('Vendor report send failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !sending && setOpen(next)}>
      <DialogTrigger asChild>
        {trigger ?? (
        <Button
          variant={variant === 'shelf' ? 'ghost' : 'default'}
          size={variant === 'track' ? 'segment' : 'sm'}
          className={cn(
            variant === 'group' && 'h-8 w-full gap-1.5 text-xs',
            variant === 'shelf' && 'h-6 gap-1 px-2 text-xs',
            'print:hidden',
            triggerClassName,
          )}
          disabled={!email || lines.length === 0}
          title={lines.length === 0 ? 'Sepet boş' : email ? undefined : "Önce İletişim'den e-posta ekleyin"}
          aria-label={`${vendorName} siparişini e-posta ile gönder`}
          {...hoverProps}
        >
          <PaperAirplaneIcon ref={sendRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
          {variant === 'group' ? 'Sipariş Ver' : 'Gönder'}
        </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sipariş ver — {vendorName}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Alıcı</span>
          <span className="truncate font-medium text-foreground">{email}</span>
        </div>
        {/* Sepet önizlemesi — e-postaya birebir bu satırlar gider */}
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
          {lines.map(({ line, qty }) => (
            <li key={line.variantId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{line.productName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[line.variantName, line.sku].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p
                  className="text-foreground"
                  title={line.isEstimate ? 'Alış fiyatı tanımlı değil; satış fiyatı kullanıldı' : undefined}
                >
                  {qty} × {formatPrice(line.unitCost)}
                </p>
                <p className="text-xs font-medium text-foreground">{formatPrice(qty * line.unitCost)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            Toplam · {lines.length} kalem
            {hasEstimate && (
              <span title="Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı"> tahmini</span>
            )}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{formatPrice(totalCost)}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Vazgeç
          </Button>
          <Button type="button" onClick={send} disabled={sending}>
            {sending ? 'Gönderiliyor…' : 'Gönder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
