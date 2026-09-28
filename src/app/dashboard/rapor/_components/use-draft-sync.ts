'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';

/** Tik/adet değişikliklerini topla, bu kadar sessizlikten sonra yaz. */
const FLUSH_DELAY_MS = 500;

export interface DraftSync {
  /** qty null = satır taslaktan çıkar. */
  queue: (variantId: string, qty: number | null) => void;
  /** Bekleyen değişiklikleri hemen yazar (gönderim ve yenileme öncesi). */
  flush: () => Promise<void>;
  /** Gönderilen tedarikçinin bekleyen değişikliklerini at — yeni taslak doğmasın. */
  drop: (variantIds: readonly string[]) => void;
}

/**
 * Satın Alma sepeti = tedarikçi taslakları (sunucuda). Tablo ve çekmece
 * state'i iyimser günceller; bu kanca farkları toplayıp
 * PUT /api/purchase-orders/draft ile yazar. Yazım hatası toast olur, state kalır.
 */
export function useDraftSync(token: string | null): DraftSync {
  const pending = useRef(new Map<string, number | null>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Önceki yazım bitsin: sıra korunur (kaldır → ekle tersine dönmesin).
    await inFlight.current;
    if (!token || pending.current.size === 0) return;
    const batch = new Map(pending.current);
    pending.current.clear();
    const set: { variantId: string; qty: number }[] = [];
    const remove: string[] = [];
    for (const [variantId, qty] of batch) {
      if (qty === null) remove.push(variantId);
      else set.push({ variantId, qty });
    }
    const write = ApiRequests.purchaseOrders
      .updateDraft(token, { set, remove })
      .then(() => undefined)
      .catch(error => {
        logger.error('Draft sync failed', { error });
        toast.error('Taslak kaydedilemedi. Sayfayı yenilemeden önce tekrar deneyin.');
      });
    inFlight.current = write;
    await write;
  }, [token]);

  const queue = useCallback(
    (variantId: string, qty: number | null) => {
      pending.current.set(variantId, qty);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), FLUSH_DELAY_MS);
    },
    [flush],
  );

  const drop = useCallback((variantIds: readonly string[]) => {
    for (const id of variantIds) pending.current.delete(id);
  }, []);

  // Sayfadan çıkarken bekleyen yazımı kaçırma.
  useEffect(() => () => void flush(), [flush]);

  return useMemo(() => ({ queue, flush, drop }), [queue, flush, drop]);
}

const noop: DraftSync = { queue: () => undefined, flush: async () => undefined, drop: () => undefined };

export const DraftSyncContext = createContext<DraftSync>(noop);

/** Gönderim dialogları bekleyen taslak yazımını buradan boşaltır. */
export function useDraftSyncContext(): DraftSync {
  return useContext(DraftSyncContext);
}
