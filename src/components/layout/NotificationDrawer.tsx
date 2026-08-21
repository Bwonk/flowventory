'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCheck,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import type { NotificationItem } from '@/app/api/notifications/route';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/animate-ui/primitives/radix/sheet';
import {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  useSidebar,
} from '@/components/animate-ui/components/radix/sidebar';
import { useNotifications } from '@/components/layout/notifications-context';

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

/** API son 50 kaydı döndürür — listenin kesildiğini kullanıcıya söyleriz. */
const LIST_CAP = 50;

const absoluteFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

const ICON_BUTTON_CLASS =
  'rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function NotificationRow({
  item,
  now,
  onNavigate,
}: {
  item: NotificationItem;
  now: number;
  onNavigate: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  const rowClass = `flex gap-2.5 border-b border-border px-4 py-3 last:border-b-0 ${
    item.read ? '' : 'bg-accent/40'
  }`;

  const content = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`text-sm text-foreground ${item.read ? 'font-normal' : 'font-medium'}`}>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          <time dateTime={item.createdAt} title={absoluteFormatter.format(new Date(item.createdAt))}>
            {timeAgo(item.createdAt, now)}
          </time>
        </p>
      </div>
      {/* Okunmamış sinyali: arka plan tonu tek başına yeterince görünür değil
          ve renk tek sinyal olamaz — nokta + başlık ağırlığı birlikte taşır. */}
      {!item.read && (
        <span className="mt-1.5 shrink-0">
          <span className="block size-2 rounded-full bg-accent-blue" aria-hidden />
          <span className="sr-only">Okunmamış</span>
        </span>
      )}
    </>
  );

  if (!item.productId) {
    return <div className={rowClass}>{content}</div>;
  }

  return (
    <Link
      href={`/dashboard/stok?product=${item.productId}`}
      onClick={() => onNavigate(item.id)}
      className={`${rowClass} transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {content}
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map(i => (
        <div key={i} className="flex gap-2.5 border-b border-border px-4 py-3">
          <div className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Bildirim drawer'ı — layout seviyesinde mount edilir ki mobilde sidebar
 * Sheet'i kapatılınca birlikte unmount olmasın. Modal: dıştaki tıklama
 * yalnızca kapatır (click-through yok), odak içeride hapsolur, arka plan
 * kaydırması kilitlenir.
 */
export function NotificationDrawer() {
  const {
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
  } = useNotifications();
  const { state, isMobile } = useSidebar();

  // Panel açıkken göreli zaman etiketleri dakikada bir tazelenir; kapalıyken
  // sayaç çalışmaz.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  // Collapse/expand'de drawer açık kalır ve clip container'ın transition-[left]'i
  // sidebar'ın 400ms genişlik animasyonunu birebir takip eder. Yalnızca
  // masaüstü ↔ mobil geçişinde kapat: iki mod tamamen farklı konumlanıyor.
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    if (isMobileRef.current !== isMobile) {
      isMobileRef.current = isMobile;
      setOpen(false);
    }
  }, [isMobile, setOpen]);

  // Trigger, Sheet ağacının dışında yaşadığı için Radix odak iadesini
  // kendimiz yaparız. Mobilde trigger sidebar'la birlikte unmount olmuş
  // olabilir — o durumda varsayılan davranış kalır.
  const handleCloseAutoFocus = (event: Event) => {
    if (triggerRef.current) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  };

  // Masaüstünde drawer'ın hizalandığı kenar — sidebar durumuna göre.
  const clipLeft = state === 'collapsed' ? CLIP_LEFT_COLLAPSED : CLIP_LEFT_EXPANDED;

  let body: ReactNode;
  if (status === 'loading') {
    body = <SkeletonRows />;
  } else if (status === 'error') {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <AlertTriangle className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Tekrar dene
        </button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
        <Bell className="size-5 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">Henüz bildirim yok</p>
        <p className="text-xs text-muted-foreground">
          Stok uyarıları ve satış sinyalleri burada görünecek.
        </p>
        <Link
          href="/dashboard/ayarlar#bildirim-ayarlari"
          onClick={() => setOpen(false)}
          className="mt-2 rounded-md text-xs text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Bildirim ayarlarını yönet
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        {items.map(item => (
          <NotificationRow
            key={item.id}
            item={item}
            now={now}
            onNavigate={id => {
              markOneRead(id);
              setOpen(false);
            }}
          />
        ))}
        {items.length >= LIST_CAP && (
          <p className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Son {LIST_CAP} bildirim gösteriliyor
          </p>
        )}
      </>
    );
  }

  const drawerBody = (
    <>
      <div className="flex items-center gap-1 border-b border-border px-4 py-3">
        <SheetTitle className="text-sm font-medium text-foreground">Bildirimler</SheetTitle>
        <div className="ml-auto flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              aria-label="Tümünü okundu işaretle"
              className={ICON_BUTTON_CLASS}
            >
              <CheckCheck className="size-4" aria-hidden />
            </button>
          )}
          <SheetClose className={ICON_BUTTON_CLASS}>
            <X className="size-4" aria-hidden />
            <span className="sr-only">Kapat</span>
          </SheetClose>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body}</div>
    </>
  );

  return (
    <>
      {/* Rozet değişimini ekran okuyucuya duyuran kalıcı bölge. */}
      <span aria-live="polite" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Okunmamış bildirim yok'}
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPortal>
          {isMobile ? (
            <>
              <SheetOverlay
                className="fixed inset-0 z-50 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <SheetContent
                side="left"
                aria-modal="true"
                aria-describedby={undefined}
                onCloseAutoFocus={handleCloseAutoFocus}
                className="z-50 flex w-[85vw] max-w-80 flex-col border-r border-hairline bg-background"
              >
                {drawerBody}
              </SheetContent>
            </>
          ) : (
            <>
              {/* Backdrop tüm ekranı kaplar; sidebar (z-10) ve drawer (z-9)
                  üstünde boyandığı için aydınlık kalır, aradaki 8px canvas
                  boşluğu kararır → pill gerçekten yüzüyormuş gibi okunur. */}
              <SheetOverlay
                className="fixed inset-0 z-[8] bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
                  aria-modal="true"
                  aria-describedby={undefined}
                  onCloseAutoFocus={handleCloseAutoFocus}
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
    </>
  );
}
