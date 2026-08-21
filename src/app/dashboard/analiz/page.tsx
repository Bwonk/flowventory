'use client';

import { logger } from '@/lib/logger';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMerchantCurrency } from '@/lib/currency';
import { AnalizContent } from './_components';
import { AnalizSkeleton } from './_components/AnalizSkeleton';

function AnalizPageContent() {
  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();
  const [insight, setInsight] = useState<InventoryInsightApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const res = await ApiRequests.insights.inventory(token);
      if (res.status === 200 && res.data?.data) {
        setInsight(res.data.data);
      } else {
        setError('Analiz verisi alınamadı.');
      }
    } catch (error) {
      logger.error('Error initializing analysis page', { error });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <AnalizSkeleton />;
  if (error) return <ErrorState description={error} onRetry={initialize} />;
  if (!insight) return null;

  return <AnalizContent insight={insight} />;
}

export default function AnalizPage() {
  return (
    <Suspense fallback={<AnalizSkeleton />}>
      <AnalizPageContent />
    </Suspense>
  );
}
