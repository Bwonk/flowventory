'use client';

import { useEffect, useState, useCallback } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import HomePage from '../../components/home-page';
import { ListProductsApiResponse } from '../api/ikas/list-products/route';

// Ürün tipini tanımlıyoruz
type Product = NonNullable<ListProductsApiResponse['products']>[0];

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [products, setProducts] = useState<Product[]>([]); // ← yeni
  const [loading, setLoading] = useState(true);            // ← yeni

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

  // Ürünleri çeken yeni fonksiyon
  const fetchProducts = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.listProducts(currentToken);
      if (res.status === 200 && res.data?.data?.products) {
        setProducts(res.data.data.products); // ← state güncelleniyor
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const initializeDashboard = useCallback(async () => {
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);

      if (fetchedToken) {
        // İki isteği paralel at — daha hızlı
        await Promise.all([
          fetchStoreName(fetchedToken),
          fetchProducts(fetchedToken),
        ]);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    } finally {
      setLoading(false); // ← yükleme bitti
    }
  }, [fetchStoreName, fetchProducts]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  return <HomePage token={token} storeName={storeName} products={products} loading={loading} />;
}