'use client';

import { logger } from '@/lib/logger';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import type { VendorListItem } from '@/app/api/vendors/route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { extractErrorMessage } from './QuickStockButton';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AddVendorDialogProps {
  token: string;
  /** Yeni tedarikçi sayfadaki listeye eklenir — atama popover'ında hemen görünür. */
  onCreated: (vendor: VendorListItem) => void;
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); verilmezse varsayılan segment buton. */
  trigger?: ReactNode;
}

/**
 * Sayfa başlığındaki "Tedarikçi Ekle" akışı. Ürün detayıyla aynı Dialog
 * primitifini kullanır (overlay/arka plan otomatik aynı). ikas'ta ürünsüz
 * tedarikçi yaratılamadığı için kayıt yerelde açılır; bir ürüne atanınca
 * ikas id'sine bağlanır.
 */
export function AddVendorDialog({ token, onCreated, trigger }: AddVendorDialogProps) {
  const { ref: plusRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail === '' || EMAIL_PATTERN.test(trimmedEmail);
  const canSave = trimmedName.length > 0 && emailValid && !saving;

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await ApiRequests.vendors.create(token, {
        vendorName: trimmedName,
        email: trimmedEmail || null,
        phone: phone.trim() || null,
      });
      const data = res.data?.data;
      if (!data) throw new Error('Empty vendor create response');
      onCreated(data);
      setOpen(false);
      reset();
      toast.success(`Tedarikçi eklendi: ${data.vendorName}`);
    } catch (error) {
      logger.error('Vendor create failed', { error });
      toast.error(extractErrorMessage(error, 'Tedarikçi eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (saving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="segment" size="segment" {...hoverProps}>
            <PlusIcon ref={plusRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
            Tedarikçi Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tedarikçi ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="new-vendor-name" className="mb-1 block text-xs text-muted-foreground">
              Tedarikçi adı
            </label>
            <Input
              id="new-vendor-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tedarikçi adı"
              disabled={saving}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-vendor-email" className="mb-1 block text-xs text-muted-foreground">
              E-posta
            </label>
            <Input
              id="new-vendor-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="siparis@tedarikci.com"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="new-vendor-phone" className="mb-1 block text-xs text-muted-foreground">
              Telefon
            </label>
            <Input
              id="new-vendor-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0 5xx xxx xx xx"
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
