'use client';

import { logger } from '@/lib/logger';
import { useState, type ReactNode } from 'react';
import { PaperAirplaneIcon } from '@/components/ui/icons/paper-airplane';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AnimatedCheckbox } from '@/components/shared/AnimatedCheckbox';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { cn } from '@/lib/utils';
import { formatPrice, getActiveCurrency } from '@/lib/currency';
import { whatsappPhone, type PurchaseOrderChannel } from '@/lib/purchase-orders/types';
import type { BasketLine } from './basket';
import { extractErrorMessage } from '@/lib/api-error';
import { printOrder } from './print-order';
import { useDraftSyncContext } from './use-draft-sync';
import { useEmailField } from './use-email-field';

interface SendReportDialogProps {
  token: string;
  vendorId: string;
  vendorName: string;
  /** Kayıtlı iletişim; eksik kanal bilgisi pencerede girilip kaydedilir. */
  contact: { email: string | null; phone: string | null };
  /** Beklenen teslim varsayılanı: bugün + tedarik süresi. */
  leadTimeDays: number;
  /** Taslak satırları — siparişe bu adetler gider. */
  lines: BasketLine[];
  onContactSaved?: (next: { email: string | null; phone: string | null }) => void;
  /** Başarılı gönderimde (taslak "Yolda"ya geçti). */
  onSent?: () => void;
  /**
   * Tetik görünümü: 'track' tedarikçi işlem yolundaki ink hap "Gönder";
   * 'group' taslak grubunun altındaki tam genişlik ink "Gönder".
   */
  variant?: 'group' | 'track';
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); disabled dışarıda hesaplanır. */
  trigger?: ReactNode;
}

const CHANNEL_ORDER: PurchaseOrderChannel[] = ['email', 'whatsapp', 'pdf'];

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const longDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
};

/**
 * Siparişi gönder — kanal seçimli onay penceresi. Seçilen kanalların hepsinden
 * gider: e-posta sunucudan, WhatsApp hazır mesajla açılır (gönder tuşuna
 * kullanıcı basar), PDF yazdırma penceresiyle. Kanal hazır değilse (e-posta /
 * telefon yok) kartın içinde tamamlanır; tetik yalnız taslak boşken kapalıdır.
 */
export function SendReportDialog({
  token,
  vendorId,
  vendorName,
  contact,
  leadTimeDays,
  lines,
  onContactSaved,
  onSent,
  variant = 'group',
  trigger,
}: SendReportDialogProps) {
  const { ref: sendRef, hoverProps } = useIconHover();
  const draftSync = useDraftSyncContext();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<Set<PurchaseOrderChannel>>(new Set());
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [days, setDays] = useState(leadTimeDays);
  const emailField = useEmailField(draftEmail);

  const savedPhone = contact.phone ? whatsappPhone(contact.phone) : null;
  const typedPhone = draftPhone.trim() ? whatsappPhone(draftPhone) : null;
  const emailReady = Boolean(contact.email) || (emailField.trimmed !== '' && emailField.valid);
  const phoneReady = Boolean(savedPhone) || Boolean(typedPhone);
  const ready: Record<PurchaseOrderChannel, boolean> = { email: emailReady, whatsapp: phoneReady, pdf: true };
  const selected = CHANNEL_ORDER.filter(c => channels.has(c));
  const missing = selected.find(c => !ready[c]);
  const canSend = selected.length > 0 && !missing && lines.length > 0;

  const totalCost = lines.reduce((sum, { line, qty }) => sum + qty * line.unitCost, 0);
  const hasEstimate = lines.some(({ line }) => line.isEstimate);

  const toggle = (channel: PurchaseOrderChannel) =>
    setChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });

  const send = async () => {
    // Açılır pencere engellenmesin: WhatsApp sekmesi tıklama anında açılır, adres sonra verilir.
    const waWindow = channels.has('whatsapp') ? window.open('about:blank', '_blank') : null;
    setSending(true);
    try {
      await draftSync.flush();
      const needsEmailSave = channels.has('email') && !contact.email;
      const needsPhoneSave = channels.has('whatsapp') && !savedPhone;
      if (needsEmailSave || needsPhoneSave) {
        const saved = await ApiRequests.vendors.updateContact(token, {
          vendorId,
          vendorName,
          email: needsEmailSave ? emailField.trimmed : contact.email,
          phone: needsPhoneSave ? draftPhone.trim() : contact.phone,
        });
        const next = saved.data?.data;
        if (!next) throw new Error('Empty vendor contact response');
        onContactSaved?.({ email: next.email, phone: next.phone });
      }

      const res = await ApiRequests.purchaseOrders.send(token, {
        vendorId,
        lines: lines.map(({ line, qty }) => ({ variantId: line.variantId, qty })),
        channels: selected,
        expectedAt: isoDateInDays(days),
      });
      const data = res.data?.data;
      if (!data) throw new Error('Empty send response');

      if (data.whatsapp) {
        const url = `https://wa.me/${data.whatsapp.phone}?text=${encodeURIComponent(data.whatsapp.text)}`;
        if (waWindow) waWindow.location.href = url;
        else toast('WhatsApp açılamadı', { action: { label: "WhatsApp'ı aç", onClick: () => window.open(url, '_blank') } });
      }
      if (channels.has('pdf')) printOrder(data.order, getActiveCurrency());

      setOpen(false);
      const via = [channels.has('email') && data.order.sentTo, channels.has('whatsapp') && 'WhatsApp', channels.has('pdf') && 'PDF']
        .filter(Boolean)
        .join(' · ');
      toast.success(`${data.order.label} gönderildi`, { description: `${via}. Adetler "Yolda"ya geçti.` });
      if (data.skipped > 0) toast.warning(`${data.skipped} ürün artık bu tedarikçide olmadığı için siparişe girmedi.`);
      onSent?.();
    } catch (error) {
      waWindow?.close();
      logger.error('Purchase order send failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (sending) return;
        setOpen(next);
        if (next) {
          // Kayıtlı bilgiye göre hazır kanallar seçili gelir; hiçbiri yoksa e-posta.
          const initial = new Set<PurchaseOrderChannel>();
          if (contact.email) initial.add('email');
          if (savedPhone) initial.add('whatsapp');
          if (initial.size === 0) initial.add('email');
          setChannels(initial);
          setDraftEmail('');
          setDraftPhone('');
          setDays(leadTimeDays);
          emailField.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="default"
            size={variant === 'track' ? 'segment' : 'sm'}
            className={cn(variant === 'group' && 'h-8 w-full gap-1.5 text-xs', 'print:hidden')}
            disabled={lines.length === 0}
            aria-label={`${vendorName} siparişini gönder`}
            {...hoverProps}
          >
            <PaperAirplaneIcon ref={sendRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
            Gönder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Siparişi gönder</DialogTitle>
          <DialogDescription className="tabular-nums">
            {vendorName} · {lines.length} kalem · {formatPrice(totalCost)}
            {hasEstimate && ' tahmini'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kanallar</p>
          <ChannelCard
            label="E-posta"
            checked={channels.has('email')}
            onToggle={() => toggle('email')}
            disabled={sending}
            status={contact.email ? { text: 'Hazır', variant: 'success' } : { text: 'E-posta eksik', variant: 'warning' }}
            description={
              contact.email ? `${contact.email} · mağaza adın ve yanıt adresinle gider` : 'Adres kaydedilir, sonraki siparişlerde sorulmaz.'
            }
          >
            {channels.has('email') && !contact.email && (
              <div>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoFocus
                  value={draftEmail}
                  onChange={e => setDraftEmail(e.target.value)}
                  onBlur={emailField.onBlur}
                  placeholder="siparis@tedarikci.com"
                  className="h-8 md:text-base pointer-fine:text-sm"
                  disabled={sending}
                  aria-label={`${vendorName} e-postası`}
                  aria-invalid={emailField.showError || undefined}
                />
                {emailField.showError && <p className="mt-1 text-xs text-destructive">Geçerli bir e-posta adresi girin.</p>}
              </div>
            )}
          </ChannelCard>
          <ChannelCard
            label="WhatsApp"
            checked={channels.has('whatsapp')}
            onToggle={() => toggle('whatsapp')}
            disabled={sending}
            status={savedPhone ? { text: 'Hazır', variant: 'success' } : { text: 'Telefon eksik', variant: 'warning' }}
            description="Hazır mesajla WhatsApp açılır, gönder tuşuna sen basarsın."
          >
            {channels.has('whatsapp') && !savedPhone && (
              <div>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={draftPhone}
                  onChange={e => setDraftPhone(e.target.value)}
                  placeholder="0 5xx xxx xx xx"
                  className="h-8 md:text-base pointer-fine:text-sm"
                  disabled={sending}
                  aria-label={`${vendorName} telefonu`}
                />
                {draftPhone.trim() !== '' && !typedPhone && (
                  <p className="mt-1 text-xs text-destructive">Geçerli bir telefon numarası girin.</p>
                )}
              </div>
            )}
          </ChannelCard>
          <ChannelCard
            label="PDF"
            checked={channels.has('pdf')}
            onToggle={() => toggle('pdf')}
            disabled={sending}
            status={{ text: 'İsteğe bağlı', variant: 'neutral' }}
            description="Sipariş belgesi yazdırma penceresiyle açılır; PDF olarak kaydedebilirsin."
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground">Beklenen teslim</p>
            <p className="text-xs text-muted-foreground">{longDate(days)}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <NumberStepper size="md" value={days} min={0} max={180} onChange={setDays} label="Kaç gün sonra teslim" disabled={sending} />
            gün sonra
          </div>
        </div>

        {hasEstimate && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Alış fiyatı tanımlı olmayan ürünler tedarikçiye fiyatsız gider.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Vazgeç
          </Button>
          <Button type="button" onClick={() => void send()} disabled={sending || !canSend}>
            {sending
              ? 'Gönderiliyor…'
              : selected.length === 0
                ? 'Kanal seçin'
                : missing === 'email'
                  ? 'E-posta girin'
                  : missing === 'whatsapp'
                    ? 'Telefon girin'
                    : selected.length === 1
                  ? 'Gönder'
                  : `${selected.length} kanaldan gönder`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelCard({
  label,
  checked,
  onToggle,
  disabled,
  status,
  description,
  children,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  status: { text: string; variant: 'success' | 'warning' | 'neutral' };
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150',
        checked ? 'border-foreground/30' : 'border-hairline',
      )}
    >
      <div className="pt-0.5">
        <AnimatedCheckbox checked={checked} onToggle={onToggle} label={`${label} ile gönder`} disabled={disabled} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <Badge variant={status.variant}>{status.text}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}
