'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Archive, Bell, TrendingUp } from 'lucide-react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { NotificationItem } from '@/app/api/notifications/route';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const TYPE_ICONS: Record<string, typeof Bell> = {
  'critical-stock': AlertTriangle,
  'dead-stock': Archive,
  'sales-spike': TrendingUp,
};

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
 * Sidebar bildirim zili — okunmamış rozeti + açılır bildirim listesi.
 * Panel açıldığında tümü okundu işaretlenir.
 */
export function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (!open || !token || unreadCount === 0) return;
      // Panel açıldı → tümünü okundu işaretle (rozet temizlenir).
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

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
          className="relative flex h-9 w-full items-center rounded-lg px-3 text-[14px] text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-primary"
        >
          <Bell className="h-4 w-4 shrink-0 md:mr-3" aria-hidden />
          <span className="hidden truncate md:inline">Bildirimler</span>
          {unreadCount > 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-sm font-medium text-foreground">Bildirimler</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
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
      </PopoverContent>
    </Popover>
  );
}
