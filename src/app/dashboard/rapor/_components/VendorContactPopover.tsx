'use client';

import { logger } from '@/lib/logger';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useEmailField } from './use-email-field';

interface VendorContactPopoverProps {
  token: string;
  vendorId: string;
  vendorName: string;
  contact: { email: string | null; phone: string | null };
  /** Sayfadaki vendorList entry'sini patch'ler — rapor refetch'i gerekmez. */
  onSaved: (contact: { email: string | null; phone: string | null }) => void;
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); verilmezse varsayılan ikon segment. */
  trigger?: ReactNode;
}

/**
 * Tedarikçi kartı başlığından hızlı iletişim düzenleme. Ayarlar →
 * Tedarikçiler ile aynı endpoint'i (PUT /api/vendors) kullanır.
 */
export function VendorContactPopover({ token, vendorId, vendorName, contact, onSaved, trigger }: VendorContactPopoverProps) {
  const { ref: envelopeRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [saving, setSaving] = useState(false);

  const emailField = useEmailField(email);
  const trimmedEmail = emailField.trimmed;
  const trimmedPhone = phone.trim();
  const emailErrorId = `contact-email-error-${vendorId}`;

  const save = async () => {
    setSaving(true);
    try {
      const res = await ApiRequests.vendors.updateContact(token, {
        vendorId,
        vendorName,
        email: trimmedEmail || null,
        phone: trimmedPhone || null,
      });
      const data = res.data?.data;
      if (!data) throw new Error('Empty vendor contact response');
      onSaved({ email: data.email, phone: data.phone });
      setOpen(false);
      toast.success('Kaydedildi');
    } catch (error) {
      logger.error('Vendor contact save failed', { vendorId, error });
      toast.error('Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (saving) return;
        setOpen(next);
        if (next) {
          // Popover her açılışta kayıtlı değerlerden başlar.
          setEmail(contact.email ?? '');
          setPhone(contact.phone ?? '');
          emailField.reset();
        }
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="segment"
            size="icon-segment"
            className="print:hidden"
            title="İletişim"
            aria-label={`${vendorName} iletişim bilgileri`}
            {...hoverProps}
          >
            <EnvelopeIcon ref={envelopeRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="z-[100] w-64 rounded-lg p-3">
        <PopoverHeader>
          <PopoverTitle>{vendorName}</PopoverTitle>
        </PopoverHeader>
        <div className="mt-2 space-y-2.5">
          <div>
            <label htmlFor={`contact-email-${vendorId}`} className="mb-1 block text-xs text-muted-foreground">
              E-posta
            </label>
            <Input
              id={`contact-email-${vendorId}`}
              type="email"
              inputMode="email"
              // Tarayıcı satıcının kendi adresini önermesin — bu tedarikçinin adresi.
              autoComplete="off"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={emailField.onBlur}
              placeholder="siparis@tedarikci.com"
              // iOS odakta zoom yapmasın: dokunmatikte 16px, ince işaretçide 14px.
              className="h-8 md:text-base pointer-fine:text-sm"
              disabled={saving}
              aria-invalid={emailField.showError || undefined}
              aria-describedby={emailField.showError ? emailErrorId : undefined}
            />
            {emailField.showError && (
              <p id={emailErrorId} className="mt-1 text-xs text-destructive">
                Geçerli bir e-posta adresi girin.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`contact-phone-${vendorId}`} className="mb-1 block text-xs text-muted-foreground">
              Telefon
            </label>
            <Input
              id={`contact-phone-${vendorId}`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0 5xx xxx xx xx"
              className="h-8 md:text-base pointer-fine:text-sm"
              disabled={saving}
            />
          </div>
          <Button type="button" size="sm" onClick={save} disabled={saving || !emailField.valid} className="w-full">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
