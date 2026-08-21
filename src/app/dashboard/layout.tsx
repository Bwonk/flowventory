'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NotificationDrawer } from '@/components/layout/NotificationDrawer';
import { NotificationsProvider } from '@/components/layout/notifications-context';
import { BrandLogo } from '@/components/shared/BrandLogo';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/animate-ui/components/radix/sidebar';

/**
 * Tüm dashboard sayfalarını sidebar shell'i ile saran düzen.
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
      logger.error('Error fetching store name', { error });
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
    <NotificationsProvider>
      <SidebarProvider>
        <AppSidebar storeName={storeName} />
        {/*
          min-w-0: inset bir flex öğesi ve varsayılan min-width:auto ile geniş tablolar
          onu içeriği kadar şişiriyordu — tablonun kendi overflow-x-auto'su devreye
          girmeden tüm sayfa yatay kayıyordu.
        */}
        <SidebarInset className="h-svh min-w-0 overflow-y-auto">
          {/* Dar iframe genişliği: sidebar Sheet'e düşer, tetikleyici bu barda yaşar. */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline bg-card px-4 print:hidden md:hidden">
            <SidebarTrigger />
            <BrandLogo variant="mark" className="h-7 w-7" />
          </header>
          {children}
        </SidebarInset>
        {/* Drawer, sidebar'ın dışında yaşar: mobilde sidebar Sheet'i kapanınca
            unmount olmaz (bkz. NotificationsProvider). */}
        <NotificationDrawer />
      </SidebarProvider>
    </NotificationsProvider>
  );
}
