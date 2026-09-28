'use client';

import { logger } from '@/lib/logger';
import { useEffect, useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { EnvelopeIcon } from '@/components/ui/icons/envelope';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Input } from '@/components/ui/input';
import { TrashIcon } from '@/components/ui/icons/trash';
import { PencilIcon } from '@/components/ui/icons/pencil';
import { OptionButton } from '@/components/shared/filters/Dropdown';
import { extractErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { NumberStepper } from '@/components/shared/NumberStepper';
import { GooPopover, GooPopoverContent, GooPopoverTrigger } from '@/components/motion/goo-popover';
import { PopoverHeader, PopoverTitle } from '@/components/ui/popover';
import { useEmailField } from './use-email-field';

const DELETE_CONFIRM_MS = 5000;

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
  /** Tedarikçideki ürün sayısı — ürünlü tedarikçi silinemez (ikas ürünü tedarikçisiz bırakmaz). */
  productCount: number;
  /** Silme sonrası sayfa listesinden düşürür. */
  onDeleted: (vendorId: string) => void;
  /** "Ürünleri taşı ve sil" hedefleri (bu tedarikçi hariç tutulur). */
  vendorOptions: ReadonlyArray<{ vendorId: string; vendorName: string }>;
  /** Tedarikçinin gönderilmiş siparişlerde gelmemiş adedi (bilgi satırı). */
  incomingQty: number;
  /** Taşıma / yeniden adlandırma bitince: rapor tazelenir, hedef sekme açılır. */
  onMoved: (vendorName: string) => Promise<void>;
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
  productCount,
  onDeleted,
  vendorOptions,
  incomingQty,
  onMoved,
  trigger,
}: VendorContactPopoverProps) {
  const { ref: envelopeRef, hoverProps } = useIconHover();
  const trash = useIconHover();
  const pencil = useIconHover();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(vendorName);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState(false);
  // Adım adım taşıma ilerlemesi (ürün sayısı).
  const [progress, setProgress] = useState<{ moved: number; total: number } | null>(null);
  useEffect(() => {
    if (!confirmMove) return;
    const t = setTimeout(() => setConfirmMove(false), DELETE_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmMove]);
  const targets = vendorOptions.filter(v => v.vendorId !== vendorId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [leadTime, setLeadTime] = useState(contact.leadTimeDays ?? defaultLeadTimeDays);
  const [moq, setMoq] = useState(contact.moq ?? 0);
  const [casePack, setCasePack] = useState(contact.casePack ?? 0);
  const [saving, setSaving] = useState(false);
  // Kalıcı silme iki adımlı: ilk tık sorar, 5 sn içinde ikinci tık siler.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), DELETE_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const remove = async () => {
    if (productCount > 0) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await ApiRequests.vendors.delete(token, { vendorId });
      if (!res.data?.data) throw new Error('Empty vendor delete response');
      setOpen(false);
      toast.success(`Tedarikçi silindi: ${vendorName}`);
      onDeleted(vendorId);
    } catch (error) {
      logger.error('Vendor delete failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Tedarikçi silinemedi.'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  /** Sunucu parti parti taşır; `done` olana kadar tekrar çağrılır. */
  const runMove = async (mode: 'merge' | 'rename', toVendorName: string) => {
    let moved = 0;
    setProgress({ moved, total: productCount });
    for (let guard = 0; guard < 200; guard++) {
      const res = await ApiRequests.vendors.move(token, { fromVendorId: vendorId, toVendorName, mode });
      const step = res.data?.data;
      if (!step) throw new Error('Empty vendor move response');
      moved += step.moved;
      setProgress({ moved, total: productCount });
      if (step.failed.length > 0) throw new Error(`${step.failed.length} ürün taşınamadı; tekrar deneyin.`);
      if (step.done) return;
      if (step.moved === 0) throw new Error('Taşıma ilerlemedi; tekrar deneyin.');
    }
    throw new Error('Taşıma tamamlanamadı; tekrar deneyin.');
  };

  const rename = async () => {
    const next = draftName.trim();
    if (!next || next.toLocaleLowerCase('tr') === vendorName.toLocaleLowerCase('tr')) {
      setEditingName(false);
      return;
    }
    try {
      await runMove('rename', next);
      setOpen(false);
      toast.success(`Tedarikçi adı değişti: ${next}`);
      await onMoved(next);
    } catch (error) {
      logger.error('Vendor rename failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Ad değiştirilemedi.'));
    } finally {
      setProgress(null);
      setEditingName(false);
    }
  };

  const moveAndDelete = async () => {
    if (!moveTarget) return;
    if (!confirmMove) {
      setConfirmMove(true);
      return;
    }
    setConfirmMove(false);
    try {
      await runMove('merge', moveTarget);
      setOpen(false);
      toast.success(`${productCount} ürün ${moveTarget} tedarikçisine taşındı, ${vendorName} silindi`);
      onDeleted(vendorId);
      await onMoved(moveTarget);
    } catch (error) {
      logger.error('Vendor move and delete failed', { vendorId, error });
      toast.error(extractErrorMessage(error, 'Ürünler taşınamadı.'));
    } finally {
      setProgress(null);
    }
  };

  const busy = saving || deleting || progress !== null;
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
        if (busy) return;
        setOpen(next);
        setConfirmDelete(false);
        setConfirmMove(false);
        setEditingName(false);
        setDraftName(vendorName);
        setMoveTarget(null);
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
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void rename();
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditingName(false);
                    setDraftName(vendorName);
                  }
                }}
                aria-label="Tedarikçi adı"
                className="h-8 md:text-base pointer-fine:text-sm"
                disabled={busy}
                maxLength={150}
              />
              <Button type="button" size="sm" className="h-8" onClick={() => void rename()} disabled={busy || !draftName.trim()}>
                {progress ? `${progress.moved}/${progress.total}` : 'Kaydet'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <PopoverTitle className="truncate">{vendorName}</PopoverTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`${vendorName} adını değiştir`}
                title="Adı değiştir"
                onClick={() => setEditingName(true)}
                disabled={busy}
                {...pencil.hoverProps}
              >
                <PencilIcon ref={pencil.ref} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
              </Button>
            </div>
          )}
          {editingName && productCount > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              ikas&apos;ta {productCount} ürün yeni ada taşınır; iletişim ve tedarik ayarları korunur.
            </p>
          )}
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
          <div className="border-t border-hairline pt-2.5">
            {incomingQty > 0 && (
              <p className="mb-2 text-xs text-muted-foreground">
                Yolda {incomingQty.toLocaleString('tr-TR')} adet var; siparişler Yolda çekmecesinde kalır ve teslim alınabilir.
              </p>
            )}
            {productCount > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {productCount} ürün var. ikas ürünü tedarikçisiz bırakmadığı için silmeden önce ürünler taşınır:
                </p>
                {targets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Taşınacak başka tedarikçi yok; önce Tedarikçi ekle.</p>
                ) : (
                  <div className="max-h-28 overflow-y-auto overscroll-contain rounded-md border border-hairline p-1" role="listbox" aria-label="Hedef tedarikçi">
                    {targets.map(t => (
                      <OptionButton
                        key={t.vendorId}
                        label={t.vendorName}
                        selected={moveTarget === t.vendorName}
                        onClick={() => {
                          setMoveTarget(t.vendorName);
                          setConfirmMove(false);
                        }}
                      />
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={confirmMove ? 'destructive' : 'ghost'}
                  onClick={() => void moveAndDelete()}
                  disabled={busy || !moveTarget}
                  className={cn('w-full gap-1.5', !confirmMove && 'text-destructive hover:text-destructive')}
                  {...trash.hoverProps}
                >
                  <TrashIcon ref={trash.ref} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
                  {progress && !editingName
                    ? `Taşınıyor… ${progress.moved}/${progress.total}`
                    : !moveTarget
                      ? 'Hedef tedarikçi seçin'
                      : confirmMove
                        ? `${moveTarget}'e taşınıp silinsin mi? Onayla`
                        : 'Ürünleri taşı ve sil'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={confirmDelete ? 'destructive' : 'ghost'}
                onClick={() => void remove()}
                disabled={busy}
                className={cn('w-full gap-1.5', !confirmDelete && 'text-destructive hover:text-destructive')}
                {...trash.hoverProps}
              >
                <TrashIcon ref={trash.ref} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
                {deleting ? 'Siliniyor…' : confirmDelete ? `${vendorName} silinsin mi? Onayla` : 'Tedarikçiyi sil'}
              </Button>
            )}
          </div>
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
