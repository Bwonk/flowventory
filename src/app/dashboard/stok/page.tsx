'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import HomePage from '../../../components/home-page';
import { ListProductsApiResponse } from '../../api/ikas/list-products/route';
import { AnalyticsApiResponse } from '../../api/ikas/analytics/route';
import { ErrorState } from '@/components/shared/ErrorState';
import { StokSkeleton } from './_components/StokSkeleton';

type Product = NonNullable<ListProductsApiResponse['products']>[0];

function StokPageContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const viewParam = searchParams.get('view');
  const productParam = searchParams.get('product');

  const initialStatusFilter = filterParam === 'tukendi' ? 'tukendi' as const
    : filterParam === 'az-kalan' ? 'az-kalan' as const
    : undefined;

  const initialViewMode = viewParam === 'dead' ? 'dead' as const : undefined;

  const [token, setToken] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [viewStats, setViewStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStoreName = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.getMerchant(currentToken);
      if (res.status === 200 && res.data?.data?.merchantInfo?.storeName) {
        setStoreName(res.data.data.merchantInfo.storeName);
      }
    } catch (error) {
      console.error('Error fetching store name:', error);
    }
  }, []);

  // Ürün listesi bu sayfanın kritik verisi; başarı durumu döndürür.
  const fetchProducts = useCallback(async (currentToken: string): Promise<boolean> => {
    try {
      const res = await ApiRequests.ikas.listProducts(currentToken);
      if (res.status === 200 && res.data?.data?.products) {
        setProducts(res.data.data.products);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error fetching products:', error);
      return false;
    }
  }, []);

  const fetchAnalytics = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.getAnalytics(currentToken);
      if (res.status === 200 && res.data?.data) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  const fetchViewStats = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.productView.getViewStats(currentToken);
      if (res.status === 200 && res.data?.data) {
        setViewStats(res.data.data as Record<string, number>);
      }
    } catch (error) {
      console.error('Error fetching view stats:', error);
    }
  }, []);

  const initializeDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);

      if (!fetchedToken) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }

      const [productsOk] = await Promise.all([
        fetchProducts(fetchedToken),
        fetchStoreName(fetchedToken),
        fetchAnalytics(fetchedToken),
        fetchViewStats(fetchedToken),
      ]);

      if (!productsOk) {
        setError('Ürün listesi alınamadı.');
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [fetchStoreName, fetchProducts, fetchAnalytics, fetchViewStats]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  if (loading) {
    return <StokSkeleton />;
  }

  if (error) {
    return <ErrorState description={error} onRetry={initializeDashboard} />;
  }

  return (
    <HomePage
      token={token}
      storeName={storeName}
      products={products}
      analytics={analytics}
      viewStats={viewStats}
      loading={loading}
      initialStatusFilter={initialStatusFilter}
      initialViewMode={initialViewMode}
      initialSelectedProductId={productParam || undefined}
    />
  );
}

export default function StokPage() {
  return (
    <Suspense fallback={<StokSkeleton />}>
      <StokPageContent />
    </Suspense>
  );
}
