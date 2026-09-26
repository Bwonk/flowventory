'use client';

import { useEffect, useRef } from 'react';
import { useSidebar } from '@/components/animate-ui/components/radix/sidebar';
import { BellIcon } from '@/components/ui/icons/bell';
import { BellAlertIcon } from '@/components/ui/icons/bell-alert';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';
import { useNotifications } from '@/components/layout/notifications-context';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PRESS_FEEDBACK_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Rozet tavanı: 100 ve üstü "99+" olarak tek değerde kalır, kaymaz. */
const BADGE_CAP = 100;
const formatBadge = (value: number) => (value >= BADGE_CAP ? '99+' : value);

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
      className={cn(
        'relative flex h-9 w-full items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
        PRESS_FEEDBACK_CLASS,
      )}
      {...hoverProps}
    >
      <TriggerBell ref={bellRef} size={16} className="flex shrink-0 mr-3 group-data-[collapsible=icon]:mr-0" aria-hidden />
      <span className="truncate group-data-[collapsible=icon]:hidden">Bildirimler</span>
      {unreadCount > 0 && (
        <>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium leading-none text-destructive-foreground tabular-nums group-data-[collapsible=icon]:hidden">
            <AnimatedNumber value={Math.min(unreadCount, BADGE_CAP)} format={formatBadge} />
          </span>
          {/* Icon modunda sayı sığmaz — nokta göster. */}
          <span className="absolute right-1 top-1 hidden size-2 rounded-full bg-status-critical group-data-[collapsible=icon]:block" />
        </>
      )}
    </button>
  );
}
