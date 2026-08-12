'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { AnalyticsApiResponse } from '@/app/api/ikas/analytics/route';
import type { ConversionInsightApiResponse } from '@/app/api/insights/conversion/route';
import type { DailyViewStatsResponse } from '@/app/api/product-view/stats/route';
import type { Product } from '@/components/home-page/types';

export interface DashboardData {
  token: string | null;
  products: Product[];
  analytics: AnalyticsApiResponse | null;
  dailyViewStats: DailyViewStatsResponse | null;
  conversionInsight: ConversionInsightApiResponse | null;
  isMockData: boolean;
  loading: boolean;
  error: string | null;
  /** Tüm verileri yeniden çeker (retry butonu için). */
  reload: () => void;
}

/**
 * Dashboard veri katmanı — token init + tüm fetch'ler + hata durumu.
 * Sayfa component'ı yalnızca render'la ilgilenir (CLAUDE.md konvansiyonu).
 */
export function useDashboardData(): DashboardData {
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [dailyViewStats, setDailyViewStats] = useState<DailyViewStatsResponse | null>(null);
  const [conversionInsight, setConversionInsight] = useState<ConversionInsightApiResponse | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (!fetchedToken) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }

      // Kritik: ürünler + analytics. Yan veriler (view, insight) hatada sessiz kalır.
      const [productsOk, analyticsOk] = await Promise.all([
        ApiRequests.ikas
          .listProducts(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data?.products) {
              setProducts(res.data.data.products);
              return true;
            }
            return false;
          })
          .catch(error => {
            logger.error('Error fetching products', { error });
            return false;
          }),
        ApiRequests.ikas
          .getAnalytics(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data) {
              setAnalytics(res.data.data);
              setIsMockData(Boolean(res.data.meta?.mocked));
              return true;
            }
            return false;
          })
          .catch(error => {
            logger.error('Error fetching analytics', { error });
            return false;
          }),
        ApiRequests.productView
          .getDailyViewStats(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data) setDailyViewStats(res.data.data);
          })
          .catch(error => logger.error('Error fetching daily view stats', { error })),
        ApiRequests.insights
          .conversion(fetchedToken)
          .then(res => {
            if (res.status === 200 && res.data?.data) setConversionInsight(res.data.data);
          })
          .catch(error => logger.error('Error fetching conversion insight', { error })),
      ]);

      if (!productsOk && !analyticsOk) {
        setError('Mağaza verileri alınamadı.');
      }
    } catch (error) {
      logger.error('Error initializing dashboard', { error });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    token,
    products,
    analytics,
    dailyViewStats,
    conversionInsight,
    isMockData,
    loading,
    error,
    reload: initialize,
  };
}
