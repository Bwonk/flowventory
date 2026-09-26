'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { MotionConfig } from 'motion/react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NotificationDrawer } from '@/components/layout/NotificationDrawer';
import { NotificationsProvider } from '@/components/layout/notifications-context';
import { SidebarCollapseGuardProvider, useGuardedSidebarOpen } from '@/components/layout/sidebar-collapse-guard';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { Toaster } from '@/components/ui/sonner';
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
  // Daraltma, sidebar içindeki açık katman (geri bildirim paneli) kapandıktan sonra uygulanır.
  const sidebar = useGuardedSidebarOpen();

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

  // reducedMotion="user": prefers-reduced-motion açıkken tüm motion
  // bileşenlerinde transform/layout animasyonları kapanır, opaklık kalır —
  // tek tek `useReducedMotion` dalı unutulan yerler için emniyet ağı.
  return (
    <MotionConfig reducedMotion="user">
      <NotificationsProvider>
        <SidebarCollapseGuardProvider value={sidebar.contextValue}>
          <SidebarProvider open={sidebar.open} onOpenChange={sidebar.onOpenChange}>
            <AppSidebar storeName={storeName} />
            {/*
              min-w-0: inset bir flex öğesi ve varsayılan min-width:auto ile geniş tablolar
              onu içeriği kadar şişiriyordu — tablonun kendi overflow-x-auto'su devreye
              girmeden tüm sayfa yatay kayıyordu.
            */}
            {/* overscroll-contain: kaydırma sona dayanınca ikas iframe'inin
                dışındaki panele zincirlenmez. */}
            <SidebarInset className="h-svh min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain">
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
            <Toaster />
          </SidebarProvider>
        </SidebarCollapseGuardProvider>
      </NotificationsProvider>
    </MotionConfig>
  );
}
