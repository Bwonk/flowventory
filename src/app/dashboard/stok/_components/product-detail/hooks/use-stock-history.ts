'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StockHistoryApiResponse } from '@/app/api/stock-history/route';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';

export type StockWindowDays = 30 | 90;

interface StockHistoryState {
  data: StockHistoryApiResponse | null;
  loading: boolean;
  error: boolean;
}

/**
 * Ürün/varyant için Stok Yolu verisi. Varyant veya pencere değişince yeniden
 * çeker; `refresh()` stok onaylandıktan sonra çağrılır (snapshot tazelendi).
 * Hata kartı/grafiği kırmaz — "veri alınamadı" durumuna düşer.
 */
export function useStockHistory(
  token: string | null,
  productId: string,
  variantId: string | null,
  days: StockWindowDays,
) {
  const [state, setState] = useState<StockHistoryState>({ data: null, loading: Boolean(token), error: false });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    setState(prev => ({ ...prev, loading: true, error: false }));
    ApiRequests.stockHistory
      .get(token, { productId, ...(variantId ? { variantId } : {}), days })
      .then(res => {
        if (ignore) return;
        const data = res.status === 200 ? res.data?.data ?? null : null;
        setState({ data, loading: false, error: !data });
      })
      .catch(error => {
        if (ignore) return;
        logger.error('Stock history fetch failed', { productId, error });
        setState({ data: null, loading: false, error: true });
      });
    return () => {
      ignore = true;
    };
  }, [token, productId, variantId, days, tick]);

  return { ...state, refresh };
}
