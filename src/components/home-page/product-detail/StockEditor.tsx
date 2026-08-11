'use client';

import React, { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { ApiRequests } from '@/lib/api-requests';

/**
 * Seçili varyant için satır içi stok düzenleme.
 * Kaydet → POST /api/ikas/update-stock (ikas'a yazar + snapshot tazeler).
 * Başarıda yeni değer lokal gösterilir; listelerin tam tazelenmesi
 * bir sonraki sayfa yüklemesinde/sync'te gerçekleşir.
 */
export const StockEditor: React.FC<{
  token: string | null;
  productId: string;
  variantId: string;
  stockLocationId: string | null;
  currentStock: number;
}> = ({ token, productId, variantId, stockLocationId, currentStock }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentStock);
  const [displayStock, setDisplayStock] = useState(currentStock);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Varyant değişince editor durumunu sıfırla.
  useEffect(() => {
    setEditing(false);
    setDraft(currentStock);
    setDisplayStock(currentStock);
    setError(null);
    setSaved(false);
  }, [variantId, currentStock]);

  if (!token || !stockLocationId) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await ApiRequests.ikas.updateStock(token, {
        productId,
        variantId,
        stockLocationId,
        stockCount: draft,
      });
      if (res.status === 200 && res.data?.data?.ok) {
        setDisplayStock(draft);
        setEditing(false);
        setSaved(true);
      } else {
        setError('Stok güncellenemedi.');
      }
    } catch {
      setError('Stok güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">STOK</p>
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            value={draft}
            autoFocus
            onChange={e => setDraft(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-20 rounded-md border border-border px-2 py-1 text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || draft === displayStock}
            title="Kaydet"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-foreground disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(displayStock);
              setError(null);
            }}
            title="Vazgeç"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold tabular-nums text-foreground">{displayStock} adet</p>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
            title="Stok düzenle"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
          {saved && <span className="text-xs text-emerald-700">ikas&apos;a kaydedildi ✓</span>}
        </>
      )}
      {saving && <span className="text-xs text-muted-foreground">Kaydediliyor…</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
};
