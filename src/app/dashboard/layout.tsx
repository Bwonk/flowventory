'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import Sidebar from '@/components/layout/Sidebar';

/**
 * Tüm dashboard sayfalarını Sidebar ile saran düzen.
 * storeName, kimliği doğrulanmış merchant verisinden çekilir (dashboard/page.tsx ile aynı desen).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [storeName, setStoreName] = useState('');

  const fetchStoreName = useCallback(async () => {
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) return;
      const res = await ApiRequests.ikas.getMerchant(token);
      if (res.status === 200 && res.data?.data?.merchantInfo?.storeName) {
        setStoreName(res.data.data.merchantInfo.storeName);
      }
    } catch (error) {
      console.error('Error fetching store name:', error);
    }
  }, []);

  // ikas platform yükleme göstergesini kapat (tüm dashboard iframe sayfaları için tek nokta).
  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    fetchStoreName();
  }, [fetchStoreName]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar storeName={storeName} />
      <main className="flex-1 overflow-y-auto bg-muted">{children}</main>
    </div>
  );
}
