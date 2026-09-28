'use client';

import { logger } from '@/lib/logger';
import { useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import { PopoverHeader, PopoverTitle } from '@/components/ui/popover';
import { useEmailField } from './use-email-field';

export type VendorSettings = {
  email: string | null;
  phone: string | null;
  leadTimeDays: number | null;
  moq: number | null;
  casePack: number | null;
};

interface VendorContactPopoverProps {
  token: string;
  vendorId: string;
  vendorName: string;
  contact: VendorSettings;
  /** Tedarikçiye özel süre yoksa gösterilen mağaza varsayılanı. */
  defaultLeadTimeDays: number;
  /** Sayfadaki vendorList entry'sini patch'ler; tedarik ayarı değiştiyse rapor tazelenir. */
  onSaved: (contact: VendorSettings) => void;
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); verilmezse varsayılan ikon segment. */
  trigger?: ReactElement;
}

/**
 * Tedarikçi ayarları — iletişim (sipariş kanalları) + tedarik (süre, MOQ,
 * koli; öneri formülünü tedarikçiye göre ayarlar). PUT /api/vendors.
 * MOQ/koli 0 = yok (koli yoksa öneri 5'e yuvarlanır).
 */
export function VendorContactPopover({
  token,
  vendorId,
  vendorName,
  contact,
  defaultLeadTimeDays,
  onSaved,
  trigger,
}: VendorContactPopoverProps) {
  const { ref: envelopeRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [leadTime, setLeadTime] = useState(contact.leadTimeDays ?? defaultLeadTimeDays);
  const [moq, setMoq] = useState(contact.moq ?? 0);
  const [casePack, setCasePack] = useState(contact.casePack ?? 0);
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
        // Varsayılana eşit ve önceden özel değilse boş kalsın: mağaza ayarı değişince izlesin.
        leadTimeDays: contact.leadTimeDays === null && leadTime === defaultLeadTimeDays ? null : leadTime,
        moq: moq > 0 ? moq : null,
        casePack: casePack > 0 ? casePack : null,
      });
      const data = res.data?.data;
      if (!data) throw new Error('Empty vendor contact response');
      onSaved({
        email: data.email,
        phone: data.phone,
        leadTimeDays: data.leadTimeDays,
        moq: data.moq,
        casePack: data.casePack,
      });
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
    <GooPopover
      align="end"
      sideOffset={6}
      open={open}
      onOpenChange={next => {
        if (saving) return;
        setOpen(next);
        if (next) {
          // Popover her açılışta kayıtlı değerlerden başlar.
          setEmail(contact.email ?? '');
          setPhone(contact.phone ?? '');
          setLeadTime(contact.leadTimeDays ?? defaultLeadTimeDays);
          setMoq(contact.moq ?? 0);
          setCasePack(contact.casePack ?? 0);
          emailField.reset();
        }
      }}
    >
      <GooPopoverTrigger>
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
      </GooPopoverTrigger>
      <GooPopoverContent aria-label="Tedarikçi ayarları" className="w-72 p-3">
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
          <div className="space-y-2 border-t border-hairline pt-2.5">
            <SupplyRow label="Tedarik süresi" hint="gün">
              <NumberStepper value={leadTime} min={1} max={365} onChange={setLeadTime} label="Tedarik süresi (gün)" disabled={saving} />
            </SupplyRow>
            <SupplyRow label="En az sipariş" hint={moq > 0 ? 'adet' : 'yok'}>
              <NumberStepper value={moq} min={0} max={100_000} onChange={setMoq} label="En az sipariş adedi" disabled={saving} />
            </SupplyRow>
            <SupplyRow label="Koli adedi" hint={casePack > 0 ? 'adet' : "5'e yuvarla"}>
              <NumberStepper value={casePack} min={0} max={10_000} onChange={setCasePack} label="Koli adedi" disabled={saving} />
            </SupplyRow>
          </div>
          <Button type="button" size="sm" onClick={save} disabled={saving || !emailField.valid} className="w-full">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </GooPopoverContent>
    </GooPopover>
  );
}

function SupplyRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}
