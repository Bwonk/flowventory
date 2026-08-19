'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Archive, Bell, TrendingUp, X } from 'lucide-react';
import { motion } from 'motion/react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { NotificationItem } from '@/app/api/notifications/route';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from '@/components/animate-ui/primitives/radix/sheet';
import {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  useSidebar,
} from '@/components/animate-ui/components/radix/sidebar';
import { BellIcon } from '@/components/ui/icons/bell';
import { BellAlertIcon } from '@/components/ui/icons/bell-alert';
import { useIconHover } from '@/components/ui/icons/use-icon-hover';

const TYPE_ICONS: Record<string, typeof Bell> = {
  'critical-stock': AlertTriangle,
  'dead-stock': Archive,
  'sales-spike': TrendingUp,
};

// Floating sidebar geometrisi: container p-2 taşır, collapsed container
// genişliği calc(icon + 1rem + 2px) (bkz. sidebar.tsx floating dalı).
// Clip container 0.5rem sidebar panelinin altına sokulur: dikiş ve
// collapse/expand animasyonundaki faz farkı bu bindirmeyle gizlenir.
const CLIP_LEFT_EXPANDED = `calc(${SIDEBAR_WIDTH} - 1rem)`;
const CLIP_LEFT_COLLAPSED = `calc(${SIDEBAR_WIDTH_ICON} + 2px)`;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

/**
 * Sidebar bildirim zili — okunmamış rozeti + sidebar kenarından kayarak açılan
 * bildirim drawer'ı. Drawer non-modal: sidebar tıklanabilir kalır, backdrop
 * yalnızca içerik alanını karartır. Açıldığında tümü okundu işaretlenir.
 */
export function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { state, isMobile } = useSidebar();
  const { ref: bellRef, hoverProps, prefersReducedMotion } = useIconHover();

  const refresh = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.notifications.list(currentToken);
      if (res.status === 200 && res.data?.data) {
        setItems(res.data.data.items);
        setUnreadCount(res.data.data.unreadCount);
      }
    } catch {
      // Bildirim çekilemezse sessiz kal — kritik akış değil.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      if (cancelled || !fetchedToken) return;
      setToken(fetchedToken);
      refresh(fetchedToken);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Collapse/expand'de drawer açık kalır ve clip container'ın transition-[left]'i
  // sidebar'ın 400ms genişlik animasyonunu birebir takip eder. Yalnızca
  // masaüstü ↔ mobil geçişinde kapat: iki mod tamamen farklı konumlanıyor.
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    if (isMobileRef.current !== isMobile) {
      isMobileRef.current = isMobile;
      setOpen(false);
    }
  }, [isMobile]);

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

  const handleOpenChange = useCallback(
    async (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) return;
      // Not: mobilde bell, sidebar Sheet'inin İÇİNDE yaşar — o Sheet'i kapatmak
      // bell'i (ve portal'lanmış drawer'ı) unmount eder. Sheet açık kalır; drawer
      // DOM'a daha sonra eklendiği için aynı z-50'de onun üstünde boyanır.
      if (!token || unreadCount === 0) return;
      // Drawer açıldı → tümünü okundu işaretle (rozet temizlenir).
      setUnreadCount(0);
      try {
        await ApiRequests.notifications.markRead(token);
        setItems(prev => prev.map(i => ({ ...i, read: true })));
      } catch {
        // İşaretleme başarısızsa bir sonraki açılışta tekrar denenir.
      }
    },
    [token, unreadCount],
  );

  // Masaüstünde drawer'ın hizalandığı kenar — sidebar durumuna göre.
  const clipLeft = state === 'collapsed' ? CLIP_LEFT_COLLAPSED : CLIP_LEFT_EXPANDED;

  const TriggerBell = unreadCount > 0 ? BellAlertIcon : BellIcon;

  const drawerBody = (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <SheetTitle className="text-sm font-medium text-foreground">Bildirimler</SheetTitle>
        <SheetClose className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden />
          <span className="sr-only">Kapat</span>
        </SheetClose>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Henüz bildirim yok.
          </p>
        ) : (
          items.map(item => {
            const Icon = TYPE_ICONS[item.type] ?? Bell;
            return (
              <div
                key={item.id}
                className={`flex gap-2.5 border-b border-border px-4 py-3 last:border-b-0 ${item.read ? '' : 'bg-accent/40'}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(item.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
          className="relative flex h-9 w-full items-center rounded-lg px-3 text-[14px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          {...hoverProps}
        >
          <TriggerBell ref={bellRef} size={16} className="flex shrink-0 mr-3 group-data-[collapsible=icon]:mr-0" aria-hidden />
          <span className="truncate group-data-[collapsible=icon]:hidden">Bildirimler</span>
          {unreadCount > 0 && (
            <>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white group-data-[collapsible=icon]:hidden">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
              {/* Icon modunda sayı sığmaz — nokta göster. */}
              <span className="absolute right-1 top-1 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block" />
            </>
          )}
        </button>
      </SheetTrigger>
      <SheetPortal>
        {isMobile ? (
          <>
            {/* Mobilde sidebar Sheet kapalı olduğundan standart tam ekran
                drawer: z-50 + ekran solundan açılır. */}
            <motion.div
              aria-hidden
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            />
            <SheetContent
              side="left"
              aria-describedby={undefined}
              className="z-50 flex w-[85vw] max-w-80 flex-col border-r border-hairline bg-background"
            >
              {drawerBody}
            </SheetContent>
          </>
        ) : (
          <>
            {/* Backdrop — non-modal Sheet'te Radix Overlay render olmaz, kendi
                motion katmanımız. Tüm ekranı kaplar; sidebar (z-10) ve drawer
                (z-9) üstünde boyandığı için aydınlık kalır, aradaki 8px canvas
                boşluğu kararır → pill gerçekten yüzüyormuş gibi okunur. */}
            <motion.div
              aria-hidden
              className="fixed inset-0 z-[8] bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            />
            {/* Clip container: drawer'ın x:-100%→0 kayışını kırpar ki floating
                sidebar ile canvas arasındaki 8px boşlukta parlamasın. z-[9]
                sidebar'ın (z-10) altı → arkasından çıkıyormuş gibi görünür.
                0.5rem panel altına bindirilir; transition-[left] sidebar
                collapse/expand animasyonuyla aynı süre/easing'de takip eder.
                data-notification-drawer globals.css'teki dikiş kuralının
                anahtarı: bu div DOM'da olduğu sürece (exit animasyonu dahil)
                sidebar panelinin sağ köşeleri düz, sağ hairline'ı gizli kalır. */}
            <div
              data-notification-drawer
              className="pointer-events-none fixed inset-y-2 right-0 z-[9] overflow-hidden transition-[left] duration-400 ease-[cubic-bezier(0.75,0,0.25,1)] motion-reduce:transition-none print:hidden"
              style={{ left: clipLeft }}
            >
              <SheetContent
                side="left"
                aria-describedby={undefined}
                className="pointer-events-auto flex h-full w-80 flex-col overflow-hidden rounded-r-lg border border-l-0 border-hairline bg-sidebar shadow-sm"
                style={{ position: 'absolute' }}
              >
                {drawerBody}
              </SheetContent>
            </div>
          </>
        )}
      </SheetPortal>
    </Sheet>
  );
}
