'use client';

import { useEffect, useRef } from 'react';
import { useSidebar } from '@/components/animate-ui/components/radix/sidebar';
import { BellIcon } from '@/components/ui/icons/bell';
import { BellAlertIcon } from '@/components/ui/icons/bell-alert';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { useNotifications } from '@/components/layout/notifications-context';

/**
 * Sidebar bildirim zili — okunmamış rozeti taşır ve bildirim drawer'ını açar.
 * Drawer'ın kendisi layout seviyesinde mount edilir (NotificationDrawer);
 * veri ve aç/kapa durumu NotificationsProvider üzerinden paylaşılır.
 */
export function NotificationBell() {
  const { open, setOpen, unreadCount, triggerRef } = useNotifications();
  const { isMobile, setOpenMobile } = useSidebar();
  const { ref: bellRef, hoverProps, prefersReducedMotion } = useIconHover();

  // Okunmamış sayısı 0'dan yukarı çıktığında zil bir kez sallanır — kalıcı
  // sinyali rozet taşıdığı için animasyon tekrarlanmaz. İkon bu geçişte
  // BellAlertIcon'a takas olur; useImperativeHandle parent effect'inden önce
  // koştuğu için ref yeni instance'ı gösterir.
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (prev === 0 && unreadCount > 0 && !prefersReducedMotion) {
      bellRef.current?.startAnimation();
    }
  }, [unreadCount, prefersReducedMotion, bellRef]);

  const TriggerBell = unreadCount > 0 ? BellAlertIcon : BellIcon;

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        // Mobilde drawer, sidebar Sheet'inin yerini alır: sidebar kapatılır ki
        // çift katman ve iki aşamalı çıkış oluşmasın. Drawer layout seviyesinde
        // mount olduğundan bu unmount'tan etkilenmez.
        if (isMobile) setOpenMobile(false);
        setOpen(true);
      }}
      className="relative flex h-9 w-full items-center rounded-lg px-3 text-[14px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      {...hoverProps}
    >
      <TriggerBell ref={bellRef} size={16} className="flex shrink-0 mr-3 group-data-[collapsible=icon]:mr-0" aria-hidden />
      <span className="truncate group-data-[collapsible=icon]:hidden">Bildirimler</span>
      {unreadCount > 0 && (
        <>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums group-data-[collapsible=icon]:hidden">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
          {/* Icon modunda sayı sığmaz — nokta göster. */}
          <span className="absolute right-1 top-1 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block" />
        </>
      )}
    </button>
  );
}
