'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCartIcon } from '@/components/ui/icons/shopping-cart';
import { TrashIcon } from '@/components/ui/icons/trash';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import type { PurchaseReportVendor } from '@/app/api/reports/purchase/route';
import type { VendorListItem } from '@/app/api/vendors/route';
import {
  basketTotals,
  clampQty,
  vendorBasketLines,
  vendorBasketTotals,
  type BasketState,
} from './basket';
import { BulkSendDialog } from './BulkSendDialog';
import { SendReportDialog } from './SendReportDialog';

interface BasketSheetProps {
  token: string | null;
  vendors: PurchaseReportVendor[];
  vendorList: VendorListItem[];
  basket: BasketState;
  onLineQtyChange: (variantId: string, qty: number | null) => void;
  /** Sepeti güncel önerilerin varsayılanına döndürür. */
  onResetBasket: () => void;
  /** Gönderim başarısında o tedarikçinin satırları sepetten düşer. */
  onVendorSent: (vendorId: string) => void;
}

/**
 * −/input/+ adet düzenleyici — hairline çerçeveli tek hap (sepet canvas'ındaki
 * "Kart Grupları" yönü); 1'de eksi satırı sepetten çıkarır.
 */
function QtyStepper({
  qty,
  onChange,
  onRemove,
  label,
}: {
  qty: number;
  onChange: (qty: number) => void;
  onRemove: () => void;
  label: string;
}) {
  const [text, setText] = useState(String(qty));
  useEffect(() => setText(String(qty)), [qty]);

  const commit = () => {
    const parsed = Number(text);
    // Boş/0/geçersiz giriş sepetten satır düşürmez — önceki değere dönülür.
    if (!Number.isFinite(parsed) || parsed < 1) {
      setText(String(qty));
      return;
    }
    onChange(clampQty(parsed));
  };

  return (
    <div className="flex h-6 shrink-0 items-center rounded-md border border-border bg-card">
      <Button
        variant="ghost"
        size="sm"
        className="size-5.5 rounded-r-none p-0 text-muted-foreground hover:text-foreground"
        onClick={() => (qty <= 1 ? onRemove() : onChange(qty - 1))}
        aria-label={`${label} adedini azalt`}
      >
        <Minus className="size-3" aria-hidden />
      </Button>
      <input
        inputMode="numeric"
        value={text}
        onChange={e => setText(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`${label} adedi`}
        className="h-full w-8 bg-transparent text-center text-xs font-medium tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        variant="ghost"
        size="sm"
        className="size-5.5 rounded-l-none p-0 text-muted-foreground hover:text-foreground"
        onClick={() => onChange(clampQty(qty + 1))}
        aria-label={`${label} adedini artır`}
      >
        <Plus className="size-3" aria-hidden />
      </Button>
    </div>
  );
}

/** Satırı sepetten çıkarır — hover animasyonu butondan sürülür (DESIGN.md ikon kuralı). */
function RemoveLineButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  const { ref, hoverProps } = useIconHover();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
      onClick={onRemove}
      aria-label={`${label} sepetten çıkar`}
      {...hoverProps}
    >
      <TrashIcon ref={ref} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
    </Button>
  );
}

/**
 * Sepet çekmecesi — tablo keşfet/ekle, burası düzenle/gönder. Satırlar
 * tedarikçiye göre gruplanır; sipariş e-postası grup başlığındaki Gönder'den
 * tedarikçi başına çıkar. Rozetli tetik butonu KPI aksiyon rafında yaşar.
 */
export function BasketSheet({
  token,
  vendors,
  vendorList,
  basket,
  onLineQtyChange,
  onResetBasket,
  onVendorSent,
}: BasketSheetProps) {
  const { ref: cartRef, hoverProps: cartHoverProps } = useIconHover();
  // Tab sırasıyla aynı mantık: "Tedarikçi atanmamış" sona pinlenir.
  const orderedVendors = [
    ...vendors.filter(v => v.vendorId !== null),
    ...vendors.filter(v => v.vendorId === null),
  ];
  const groups = orderedVendors
    .map(vendor => ({ vendor, lines: vendorBasketLines(vendor, basket) }))
    .filter(g => g.lines.length > 0);
  const totals = basketTotals(vendors, basket);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="segment"
          size="segment"
          aria-label={`Sepet, ${totals.count} kalem`}
          {...cartHoverProps}
        >
          <ShoppingCartIcon ref={cartRef} size={12} className="flex shrink-0 [&>svg]:size-3!" aria-hidden />
          Sepet
          {totals.count > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium tabular-nums text-primary-foreground">
              {totals.count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-hairline pb-3">
          {/* Mono mikro-etiket aynı zamanda erişilebilir başlık — ayrı toplam satırı yok,
              toplamlar grup kartlarında ve footer'da yaşar. */}
          <SheetTitle className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            Sepet
          </SheetTitle>
          <SheetDescription className="text-xs">
            Adetleri burada düzenleyin; sipariş tedarikçi başına e-posta ile gider.
          </SheetDescription>
        </SheetHeader>

        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-foreground">Sepet boş</p>
            <p className="text-xs text-muted-foreground">
              Tablodaki kutucukları tıklayarak sipariş etmek istediğiniz ürünleri ekleyin.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {/* Grup dili: "Kart Grupları" yönü (sepet canvas'ı) — beyaz çekmece
                yüzeyinde ikinci seviye bg-muted blok, çerçevesiz/gölgesiz
                (kart-içinde-kart kuralı); satır listesi blok içinde beyaz yüzey. */}
            {groups.map(({ vendor, lines }) => {
              const vendorTotals = vendorBasketTotals(vendor, basket);
              const contact = vendorList.find(v => v.vendorId === vendor.vendorId);
              return (
                <section
                  key={vendor.vendorId ?? 'none'}
                  aria-label={vendor.vendorName}
                  className="rounded-lg bg-muted"
                >
                  <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'truncate text-sm font-semibold text-foreground',
                          vendor.vendorId === null && 'text-muted-foreground',
                        )}
                      >
                        {vendor.vendorId === null ? 'Tedarikçi atanmamış' : vendor.vendorName}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">{vendorTotals.count} kalem</p>
                    </div>
                    {/* Grup toplamı sağda vurgulu (Kart × Sevkiyat karması) */}
                    <p
                      className="shrink-0 text-sm font-semibold tabular-nums text-foreground"
                      title={vendorTotals.hasEstimate ? 'Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı' : undefined}
                    >
                      {formatPrice(vendorTotals.total)}
                    </p>
                  </div>
                  <ul className="mx-2 mb-2 divide-y divide-border rounded-md bg-card">
                    {lines.map(({ line, qty }) => (
                      <li key={line.variantId} className="flex items-center gap-2.5 px-3 py-2">
                        {line.imageUrl ? (
                          <Image
                            src={line.imageUrl}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 rounded border border-border object-cover"
                            unoptimized
                          />
                        ) : (
                          <span aria-hidden className="size-6 shrink-0 rounded border border-border bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {line.productName}
                            {line.urgent && (
                              <Badge variant="critical" className="ml-1.5 align-middle">
                                acil
                              </Badge>
                            )}
                          </p>
                          {line.variantName && (
                            <p className="truncate text-xs text-muted-foreground">{line.variantName}</p>
                          )}
                        </div>
                        <QtyStepper
                          qty={qty}
                          onChange={next => onLineQtyChange(line.variantId, next)}
                          onRemove={() => onLineQtyChange(line.variantId, null)}
                          label={line.productName}
                        />
                        <p
                          className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-foreground"
                          title={line.isEstimate ? 'Alış fiyatı tanımlı değil; satış fiyatıyla hesaplandı' : undefined}
                        >
                          {formatPrice(qty * line.unitCost)}
                        </p>
                        <RemoveLineButton
                          onRemove={() => onLineQtyChange(line.variantId, null)}
                          label={line.productName}
                        />
                      </li>
                    ))}
                  </ul>
                  {vendor.vendorId !== null && token ? (
                    <div className="px-2 pb-2">
                      <SendReportDialog
                        token={token}
                        vendorId={vendor.vendorId}
                        vendorName={vendor.vendorName}
                        email={contact?.email ?? null}
                        lines={lines}
                        onSent={() => onVendorSent(vendor.vendorId!)}
                        variant="group"
                      />
                    </div>
                  ) : (
                    <p className="px-3 pb-2.5 text-xs text-muted-foreground">
                      Sipariş göndermek için tedarikçi atayın.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <SheetFooter
          className={cn('gap-2 border-t border-hairline', groups.length === 0 && 'border-t-0')}
        >
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onResetBasket}>
              Sıfırla
            </Button>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatPrice(totals.total)}
              {totals.hasEstimate && (
                <span
                  className="text-xs font-normal text-muted-foreground"
                  title="Bazı satırlarda alış fiyatı yok; satış fiyatı kullanıldı"
                >
                  {' '}tahmini
                </span>
              )}
            </p>
          </div>
          {token && (
            <>
              <BulkSendDialog
                token={token}
                groups={groups
                  .filter(g => g.vendor.vendorId !== null)
                  .map(g => ({
                    ...g,
                    email: vendorList.find(v => v.vendorId === g.vendor.vendorId)?.email ?? null,
                  }))}
                onVendorSent={onVendorSent}
              />
              <p className="text-center text-[10px] text-muted-foreground">
                Her tedarikçiye kendi sipariş e-postası ayrı gönderilir.
              </p>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
