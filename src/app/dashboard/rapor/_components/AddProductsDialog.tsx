'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import type { ListProductsApiResponse } from '@/app/api/ikas/list-products/route';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons/plus';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { Input } from '@/components/ui/input';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { extractErrorMessage } from './QuickStockButton';

type ProductRow = NonNullable<ListProductsApiResponse['products']>[number];

/** assign-vendor endpoint'inin istek başına ürün limiti. */
const ASSIGN_BATCH_SIZE = 50;

// tw-animate-css değişken override'ları: buton-kökenli büyüme okunaklı olsun
// diye zoom 0.75'ten başlar/biter; merkez-slide (slide-in-from-bottom) iptal —
// origin'li zoom'la üst üste binince yörünge eğriliyordu.
const GROW_FROM_TRIGGER_STYLE = {
  '--tw-enter-scale': '0.75',
  '--tw-exit-scale': '0.75',
  '--tw-enter-translate-y': '0',
} as CSSProperties;

interface AddProductsDialogProps {
  token: string;
  vendorName: string;
  /** Atama sonrası rapor refetch'i; satırlar bu tedarikçinin tab'ına gelir. */
  onAssigned: () => Promise<void>;
  /** Aksiyon kümesindeki kompakt buton (h-6) — boş tab CTA'sında normal boy. */
  compact?: boolean;
  /** Dış tetikleyici (ör. ExpandableActionBar öğesi); büyüme kökeni yine tetikleyiciden ölçülür. */
  trigger?: ReactNode;
}

/**
 * Tedarikçi tab'ındaki "Ürün Ekle" akışı. Tüm ürünler listelenir (stok
 * sayfasıyla aynı tam-liste + istemci tarafı arama deseni); seçilenler
 * ikas'a vendor olarak yazılır — tedarikçi ikas admin'de ilk atamayla
 * gerçekten oluşur. Başka tedarikçideki ürün uyarıyla taşınabilir.
 */
export function AddProductsDialog({ token, vendorName, onAssigned, compact, trigger }: AddProductsDialogProps) {
  const { ref: plusRef, hoverProps } = useIconHover();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentNodeRef = useRef<HTMLDivElement | null>(null);

  // Zoom, dialog merkezinden değil tetikleyen butondan büyüsün/butona
  // küçülsün. Origin buton merkezine göre iki anda yazılır: (1) content DOM'a
  // bağlanırken (callback ref — animasyon ilk boyamada başladığı için rect'ler
  // henüz transformsuz), (2) kapanış isteğinde — içerik yüklenince dialog
  // boyutu değiştiğinden mount'taki origin exit için bayatlamış olabilir.
  const applyGrowOrigin = useCallback((node: HTMLDivElement) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const t = trigger.getBoundingClientRect();
    const c = node.getBoundingClientRect();
    node.style.transformOrigin = `${t.left + t.width / 2 - c.left}px ${t.top + t.height / 2 - c.top}px`;
  }, []);

  const setContentNode = useCallback(
    (node: HTMLDivElement | null) => {
      contentNodeRef.current = node;
      if (node) applyGrowOrigin(node);
    },
    [applyGrowOrigin],
  );
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiRequests.ikas.listProducts(token);
      setProducts(res.data?.data?.products ?? []);
    } catch (error) {
      logger.error('Product list fetch failed', { error });
      toast.error('Ürün listesi yüklenemedi.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open && products === null && !loading) fetchProducts();
  }, [open, products, loading, fetchProducts]);

  const lowered = query.trim().toLocaleLowerCase('tr');
  const filtered = useMemo(() => {
    if (!products) return [];
    if (!lowered) return products;
    return products.filter(
      p =>
        p.name.toLocaleLowerCase('tr').includes(lowered) ||
        p.variants.some(v => v.sku?.toLocaleLowerCase('tr').includes(lowered)),
    );
  }, [products, lowered]);

  const movedCount = useMemo(() => {
    if (!products) return 0;
    return products.filter(p => selected.has(p.id) && p.vendor && p.vendor.name !== vendorName).length;
  }, [products, selected, vendorName]);

  const toggle = (productId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const reset = () => {
    setQuery('');
    setSelected(new Set());
  };

  /** Programatik kapanışlar da (Vazgeç, başarılı atama) origin'i tazelesin. */
  const closeDialog = () => {
    if (contentNodeRef.current) applyGrowOrigin(contentNodeRef.current);
    setOpen(false);
  };

  const assign = async () => {
    const productIds = Array.from(selected);
    if (productIds.length === 0) return;
    setSaving(true);
    try {
      const failed: string[] = [];
      for (let i = 0; i < productIds.length; i += ASSIGN_BATCH_SIZE) {
        const batch = productIds.slice(i, i + ASSIGN_BATCH_SIZE);
        const res = await ApiRequests.ikas.assignVendor(token, { productIds: batch, vendorName });
        failed.push(...(res.data?.data?.failed ?? []));
      }
      const okCount = productIds.length - failed.length;
      if (failed.length > 0) {
        toast.warning(`${okCount} ürün eklendi, ${failed.length} ürün eklenemedi.`);
      } else {
        toast.success(`${okCount} ürün ${vendorName} tedarikçisine eklendi.`);
      }
      closeDialog();
      reset();
      await onAssigned();
    } catch (error) {
      logger.error('Vendor product assign failed', { vendorName, error });
      toast.error(extractErrorMessage(error, 'Ürünler eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (saving) return;
        // Kapanış zoom'u güncel boyuta göre butona toplansın.
        if (!next && contentNodeRef.current) applyGrowOrigin(contentNodeRef.current);
        setOpen(next);
        if (!next) reset();
      }}
    >
      {/* ref DialogTrigger'da: asChild ile dış tetikleyiciye de biner (büyüme kökeni). */}
      <DialogTrigger asChild ref={triggerRef}>
        {trigger ?? (
          <Button
            // Kompakt hali tedarikçi işlem yolunda yaşar — yolun segment dili.
            variant={compact ? 'segment' : 'outline'}
            size={compact ? 'segment' : 'sm'}
            className={compact ? undefined : 'gap-1.5'}
            aria-label={`${vendorName} tedarikçisine ürün ekle`}
            {...hoverProps}
          >
            <PlusIcon ref={plusRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
            Ürün Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent ref={setContentNode} className="max-w-md" style={GROW_FROM_TRIGGER_STYLE}>
        <DialogHeader>
          <DialogTitle>Ürün ekle — {vendorName}</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ürün veya SKU ara…"
          className="h-8 text-sm"
          disabled={saving}
          autoFocus
        />
        <div className="relative -mx-1">
          {/* pb-16: tam dipte son satır blur bandının üstünde okunur kalsın.
              Scrollbar gizli: blur overlay'i native çubuğu bulanıklaştırıyordu;
              kaydırılabilirlik affordance'ı zaten blur/fade'in kendisi. */}
          <div className="max-h-72 overflow-y-auto px-1 pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {lowered ? 'Aramayla eşleşen ürün yok.' : 'Ürün bulunamadı.'}
            </p>
          )}
          {!loading &&
            filtered.map(product => {
              const alreadyHere = product.vendor?.name === vendorName;
              const isSelected = selected.has(product.id);
              const thumb = product.variants.find(v => v.imageUrl)?.imageUrl;
              const skuSummary = product.variants
                .map(v => v.sku)
                .filter(Boolean)
                .slice(0, 2)
                .join(', ');
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={saving || alreadyHere}
                  onClick={() => toggle(product.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                    alreadyHere ? 'opacity-50' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border border-border',
                      (isSelected || alreadyHere) && 'border-primary bg-primary text-primary-foreground',
                    )}
                    aria-hidden
                  >
                    {(isSelected || alreadyHere) && <Check className="size-3" />}
                  </span>
                  {thumb && (
                    <Image
                      src={thumb}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded object-cover"
                      unoptimized
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{product.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {alreadyHere
                        ? 'Bu tedarikçide'
                        : product.vendor
                          ? `Mevcut: ${product.vendor.name}`
                          : (skuSummary || `${product.variants.length} varyant`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* Kaydırılabilir listenin altında "devamı var" hissi veren aşamalı blur. */}
          <ProgressiveBlur position="bottom" height="72px" blurLevels={[1, 2, 4, 8, 12]} />
          {/* Bulanık içerik dialog zeminine yumuşak karışsın — keskin beyaz kesim olmasın. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-background to-transparent"
          />
        </div>
        {movedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {movedCount} ürün mevcut tedarikçisinden bu tedarikçiye taşınacak.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={assign} disabled={selected.size === 0 || saving}>
            {saving ? 'Ekleniyor…' : `${selected.size} ürünü ekle`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
