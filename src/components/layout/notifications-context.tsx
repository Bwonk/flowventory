'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import type { NotificationItem } from '@/app/api/notifications/route';

export type NotificationsStatus = 'loading' | 'error' | 'ready';

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  status: NotificationsStatus;
  /** status 'error' iken gösterilecek kısa mesaj. */
  errorMessage: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Drawer kapanınca odağın döneceği tetikleyici buton. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  retry: () => void;
  markAllRead: () => void;
  markOneRead: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications, NotificationsProvider içinde kullanılmalı');
  }
  return ctx;
}

const AUTH_ERROR = 'Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.';
const FETCH_ERROR = 'Bildirimler yüklenemedi.';

/**
 * Bildirim verisini ve drawer aç/kapa durumunu tutar. Tetikleyici (zil)
 * sidebar footer'ında, drawer ise layout seviyesinde yaşar — mobilde sidebar
 * Sheet'i kapatılınca drawer'ın unmount olmaması bu ayrımı gerektirir.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<NotificationsStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // İlk başarılı yüklemeden sonra arka plan yenilemeleri sessizce başarısız
  // olabilir — eldeki liste hata ekranıyla değiştirilmez.
  const hasDataRef = useRef(false);

  const refresh = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.notifications.list(currentToken);
      if (res.status !== 200 || !res.data?.data) throw new Error('Bildirim listesi alınamadı');
      setItems(res.data.data.items);
      setUnreadCount(res.data.data.unreadCount);
      hasDataRef.current = true;
      setStatus('ready');
    } catch {
      if (!hasDataRef.current) {
        setStatus('error');
        setErrorMessage(FETCH_ERROR);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      if (cancelled) return;
      if (!fetchedToken) {
        setStatus('error');
        setErrorMessage(AUTH_ERROR);
        return;
      }
      setToken(fetchedToken);
      refresh(fetchedToken);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Sekme öne gelince rozeti tazele — veri yalnızca mount'ta çekilirse gün
  // boyu açık kalan sekmede bayatlıyor.
  useEffect(() => {
    if (!token) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh(token);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [token, refresh]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setOpenState(nextOpen);
      // Açılış artık okundu işaretlemez, yalnızca listeyi tazeler; okundu
      // işaretleme kullanıcı eylemine (satır tıklama / tümünü okundu) bağlı.
      if (nextOpen && token) refresh(token);
    },
    [token, refresh],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    (async () => {
      const currentToken = token ?? (await TokenHelpers.getTokenForIframeApp());
      if (!currentToken) {
        setStatus('error');
        setErrorMessage(AUTH_ERROR);
        return;
      }
      if (!token) setToken(currentToken);
      refresh(currentToken);
    })();
  }, [token, refresh]);

  const markAllRead = useCallback(() => {
    if (!token || unreadCount === 0) return;
    const prevItems = items;
    const prevUnread = unreadCount;
    setItems(prev => prev.map(i => (i.read ? i : { ...i, read: true })));
    setUnreadCount(0);
    ApiRequests.notifications.markRead(token).catch(() => {
      setItems(prevItems);
      setUnreadCount(prevUnread);
    });
  }, [token, items, unreadCount]);

  const markOneRead = useCallback(
    (id: string) => {
      if (!token) return;
      const target = items.find(i => i.id === id);
      if (!target || target.read) return;
      setItems(prev => prev.map(i => (i.id === id ? { ...i, read: true } : i)));
      setUnreadCount(prev => Math.max(0, prev - 1));
      ApiRequests.notifications.markRead(token, [id]).catch(() => {
        // Satır tıklaması navigasyonla sonuçlanır; başarısızlık bir sonraki
        // yenilemede sunucu durumundan düzelir.
      });
    },
    [token, items],
  );

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      status,
      errorMessage,
      open,
      setOpen,
      triggerRef,
      retry,
      markAllRead,
      markOneRead,
    }),
    [items, unreadCount, status, errorMessage, open, setOpen, retry, markAllRead, markOneRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
