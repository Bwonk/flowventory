'use client';

import React, { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import type { VariantStockLocation } from '@/lib/products/product';
import { daysOfCover } from '@/lib/stock-history/projection';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Seçili varyant için satır içi stok düzenleme.
 *
 * ikas admin'e yazdığı için doğrudan değil, küçük bir onay popover'ı
 * üzerinden çalışır (rapor sayfasındaki QuickStockButton ile aynı dil):
 * kalem → değer → ✓/Enter → "12 → 40 (+28)" onayı → POST /api/ikas/update-stock.
 * Başarı toast'ındaki "Geri Al" önceki mutlak değeri geri yazar. Onaylanan
 * değer `onStockChange` ile üst listeye bildirilir (modal başlığı, varyant
 * kartı ve tablo satırı sunucuya gitmeden güncellenir).
 *
 * Satış hızı verilmişse popover "→ ~N gün idare eder" der: stok girişinin
 * etkisi sayıya dökülür (Stok Yolu kuramı).
 *
 * Çok depolu mağaza (B16): varyant stoğu tüm depoların toplamı, ama ikas'a
 * yazarken hedef depo belli olmak zorunda. Tek depo varsa tek satır;
 * birden fazlaysa toplam + depo bazlı satırlar. (ikas Admin API depo adı
 * vermediği için depolar sırayla numaralanır.)
 */

const rowClass = 'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2';

const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);

/** Tek bir deponun stoğunu düzenleyen satır. */
const LocationRow: React.FC<{
  token: string;
  productId: string;
  variantId: string;
  label: string;
  stockLocationId: string;
  currentStock: number;
  /** Depodaki stok ikas'a yazıldıktan sonra (ve geri alındığında) çağrılır. */
  onCommitted: (stockCount: number) => void;
  /** Taslak değer değiştikçe (düzenleme kapanınca null) — grafik projeksiyonu için. */
  onDraftChange?: (draft: number | null) => void;
  velocityPerDay?: number | null;
  portalContainer?: HTMLElement | null;
}> = ({
  token,
  productId,
  variantId,
  label,
  stockLocationId,
  currentStock,
  onCommitted,
  onDraftChange,
  velocityPerDay,
  portalContainer,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentStock);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = draft !== currentStock;
  const delta = draft - currentStock;
  const cover = velocityPerDay != null ? daysOfCover(draft, velocityPerDay) : null;

  const updateDraft = (next: number) => {
    setDraft(next);
    onDraftChange?.(next === currentStock ? null : next);
  };

  const stopEditing = () => {
    setConfirmOpen(false);
    setEditing(false);
    setDraft(currentStock);
    onDraftChange?.(null);
  };

  const requestConfirm = () => {
    if (!dirty || saving) return;
    setConfirmOpen(true);
  };

  const writeStock = (stockCount: number) =>
    ApiRequests.ikas.updateStock(token, { productId, variantId, stockLocationId, stockCount });

  const confirm = async () => {
    const previous = currentStock;
    const next = draft;
    setConfirmOpen(false);
    setSaving(true);
    try {
      const res = await writeStock(next);
      if (res.status !== 200 || !res.data?.data?.ok) throw new Error('update-stock failed');

      onCommitted(next);
      setEditing(false);
      onDraftChange?.(null);

      const undo = async () => {
        try {
          await writeStock(previous);
          onCommitted(previous);
          toast.success('Geri alındı');
        } catch (error) {
          logger.error('Stock undo failed', { variantId, error });
          toast.error('Geri alınamadı.');
        }
      };

      toast.success(`Stok güncellendi: ${previous} → ${next}`, {
        action: { label: 'Geri Al', onClick: undo },
      });
    } catch (error) {
      logger.error('Stock update failed', { variantId, error });
      toast.error(extractErrorMessage(error, 'Stok güncellenemedi.'));
      // Düzenleme modunda kal: kullanıcı değeri düzeltip yeniden deneyebilir.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={rowClass}>
      <p
        className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        title={`Depo kimliği: ${stockLocationId}`}
      >
        {label}
      </p>
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            value={draft}
            autoFocus
            disabled={saving}
            aria-label={`${label} stok adedi`}
            onChange={e => updateDraft(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                requestConfirm();
              }
              if (e.key === 'Escape' && !confirmOpen) stopEditing();
            }}
            className="w-20 rounded-md border border-border px-2 py-1 text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <Popover open={confirmOpen} onOpenChange={next => !saving && setConfirmOpen(next)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={requestConfirm}
                disabled={saving || !dirty}
                title="Kaydet"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-foreground disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent container={portalContainer} align="start" className="w-64 p-3">
              <p className="font-mono text-sm tabular-nums text-foreground">
                {currentStock} → {draft}{' '}
                <span className="text-muted-foreground">({formatDelta(delta)})</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cover !== null && (
                  <>
                    <span className="tabular-nums">→ ~{cover} gün idare eder.</span>{' '}
                  </>
                )}
                ikas admin&apos;deki stok da güncellenir.
              </p>
              <div className="mt-3 flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setConfirmOpen(false)}
                >
                  Vazgeç
                </Button>
                <Button size="sm" className="h-6 px-2 text-xs" autoFocus onClick={confirm}>
                  Onayla
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={stopEditing}
            disabled={saving}
            title="Vazgeç"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold tabular-nums text-foreground">{currentStock} adet</p>
          <button
            type="button"
            onClick={() => {
              setDraft(currentStock);
              setEditing(true);
            }}
            title="Stok düzenle"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
};

export const StockEditor: React.FC<{
  token: string | null;
  productId: string;
  variantId: string;
  locations: VariantStockLocation[];
  portalContainer?: HTMLElement | null;
  /** Depo stoğu ikas'a yazıldıktan sonra (mutlak değer). */
  onStockChange?: (stockLocationId: string, stockCount: number) => void;
  /** Varyantın taslak toplam stoğu (düzenleme yokken null) — Stok Yolu grafiği için. */
  onDraftTotalChange?: (total: number | null) => void;
  /** Varyantın 30 günlük günlük satış hızı — popover'daki "kaç gün idare eder" için. */
  velocityPerDay?: number | null;
}> = ({ token, productId, variantId, locations, portalContainer, onStockChange, onDraftTotalChange, velocityPerDay }) => {
  // Depo sayaçları burada tutulur: kayıt/geri al sonrası TOPLAM satırı doğru kalır.
  // Varyant değişince bileşen `key` ile sıfırlanır (ProductDetailContent).
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(locations.map(l => [l.stockLocationId, l.stockCount])),
  );
  const [drafts, setDrafts] = useState<Record<string, number | null>>({});

  if (!token || locations.length === 0) return null;

  const singleLocation = locations.length === 1;
  const total = locations.reduce((sum, l) => sum + (counts[l.stockLocationId] ?? l.stockCount), 0);

  const commit = (stockLocationId: string, stockCount: number) => {
    setCounts(prev => ({ ...prev, [stockLocationId]: stockCount }));
    onStockChange?.(stockLocationId, stockCount);
  };

  const handleDraft = (stockLocationId: string, draft: number | null) => {
    const nextDrafts = { ...drafts, [stockLocationId]: draft };
    setDrafts(nextDrafts);
    if (!onDraftTotalChange) return;
    const anyDraft = Object.values(nextDrafts).some(d => d !== null);
    if (!anyDraft) {
      onDraftTotalChange(null);
      return;
    }
    const draftTotal = locations.reduce(
      (sum, l) => sum + (nextDrafts[l.stockLocationId] ?? counts[l.stockLocationId] ?? l.stockCount),
      0,
    );
    onDraftTotalChange(draftTotal);
  };

  return (
    <div className="flex flex-col gap-2">
      {!singleLocation && (
        <div className={rowClass}>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            TOPLAM STOK
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">{total} adet</p>
          <span className="text-xs text-muted-foreground">{locations.length} depo</span>
        </div>
      )}
      {locations.map((location, index) => (
        // key'e depo dahil: varyant/depo değişince satır state'i (taslak) sıfırlanır.
        <LocationRow
          key={`${variantId}:${location.stockLocationId}`}
          token={token}
          productId={productId}
          variantId={variantId}
          label={singleLocation ? 'STOK' : `DEPO ${index + 1}`}
          stockLocationId={location.stockLocationId}
          currentStock={counts[location.stockLocationId] ?? location.stockCount}
          onCommitted={count => commit(location.stockLocationId, count)}
          onDraftChange={draft => handleDraft(location.stockLocationId, draft)}
          velocityPerDay={velocityPerDay}
          portalContainer={portalContainer}
        />
      ))}
    </div>
  );
};
