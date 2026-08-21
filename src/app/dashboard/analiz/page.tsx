'use client';

import { logger } from '@/lib/logger';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { InventoryInsightApiResponse } from '@/app/api/insights/inventory/route';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMerchantCurrency } from '@/lib/currency';
import { AnalizContent } from './_components';
import { AnalizSkeleton } from './_components/AnalizSkeleton';
import { parseAbcParam, parseActionParam, parseAgingParam, parseBandParam } from './_components/constants';
import type { AnalysisInitialFilters } from './_components/hooks/use-analysis-filters';

function AnalizPageContent() {
  // Mağaza para birimini tazeler; formatPrice aktif kodu okur.
  useMerchantCurrency();
  // URL paramları başlangıç filtresi olur (stok deseni: tek yön, geri yazılmaz).
  const searchParams = useSearchParams();
  const initialFilters = useMemo<AnalysisInitialFilters>(
    () => ({
      abc: parseAbcParam(searchParams.get('abc')),
      aging: parseAgingParam(searchParams.get('aging')),
      band: parseBandParam(searchParams.get('band')),
      action: parseActionParam(searchParams.get('action')),
    }),
    [searchParams],
  );
  // Analiz penceresi — değişince API'den taze veri çekilir (URL: ?window=60).
  const [windowDays, setWindowDays] = useState<30 | 60>(searchParams.get('window') === '60' ? 60 : 30);

  const [insight, setInsight] = useState<InventoryInsightApiResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      setToken(token || null);
      if (!token) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const res = await ApiRequests.insights.inventory(token, windowDays);
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
  }, [windowDays]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <AnalizSkeleton />;
  if (error) return <ErrorState description={error} onRetry={initialize} />;
  if (!insight) return null;

  return <AnalizContent insight={insight} token={token} initialFilters={initialFilters} onWindowChange={setWindowDays} />;
}

export default function AnalizPage() {
  return (
    <Suspense fallback={<AnalizSkeleton />}>
      <AnalizPageContent />
    </Suspense>
  );
}
