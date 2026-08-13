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
import { useSidebar } from '@/components/animate-ui/components/radix/sidebar';

const TYPE_ICONS: Record<string, typeof Bell> = {
  'critical-stock': AlertTriangle,
  'dead-stock': Archive,
  'sales-spike': TrendingUp,
};

// Sidebar genişlikleri — sidebar.tsx'teki SIDEBAR_WIDTH / SIDEBAR_WIDTH_ICON
// sabitleriyle eş. Export edilmedikleri ve --sidebar-width var'ı wrapper'da
// tanımlı olduğu için (drawer body'ye portal oluyor) burada yerel tutuluyor.
const SIDEBAR_EDGE_EXPANDED = '16rem';
const SIDEBAR_EDGE_COLLAPSED = '3rem';

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

  // Sidebar genişliği değişirse (collapse/expand, mobil geçiş) drawer'ı kapat:
  // kenara yapışık kaldığı için sidebar'ın 400ms genişlik animasyonunu takip
  // etmek yerine kapanması daha temiz.
  const sidebarStateRef = useRef(state);
  useEffect(() => {
    if (sidebarStateRef.current !== state) {
      sidebarStateRef.current = state;
      setOpen(false);
    }
  }, [state]);

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

  // Drawer'ın (ve backdrop'un) sol kenarı: sidebar'ın sağ kenarına yapışır.
  const edge = state === 'collapsed' ? SIDEBAR_EDGE_COLLAPSED : SIDEBAR_EDGE_EXPANDED;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
          className="relative flex h-9 w-full items-center rounded-lg px-3 text-[14px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Bell className="h-4 w-4 shrink-0 mr-3 group-data-[collapsible=icon]:mr-0" aria-hidden />
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
        {/* Backdrop — non-modal Sheet'te Radix Overlay render olmaz, kendi
            motion katmanımız: sidebar'ı karartmaz, içerik alanında başlar. */}
        <motion.div
          aria-hidden
          className="fixed inset-y-0 right-0 z-[8] bg-black/50 max-md:inset-0 max-md:z-50"
          style={isMobile ? undefined : { left: edge }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        />
        {/* z-[9] sidebar'ın (z-10) altı: drawer x:-100%→0 kayarken sidebar'ın
            arkasından çıkıyormuş gibi görünür. Mobilde sidebar Sheet kapalı
            olduğundan standart z-50 + ekran solundan açılır. */}
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="z-[9] flex w-80 flex-col border-r border-hairline bg-background max-md:z-50 max-md:w-[85vw] max-md:max-w-80"
          style={isMobile ? undefined : { left: edge }}
        >
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
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
