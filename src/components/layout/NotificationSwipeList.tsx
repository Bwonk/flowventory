'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Archive, Bell, Mail, MailOpen, Radar, Trash2, TrendingUp } from 'lucide-react';
import type { NotificationItem } from '@/app/api/notifications/route';
import {
  SwipeableList,
  type SwipeableListItem,
  type SwipeableListValue,
} from '@/components/motion/swipeable-list';

const TYPE_ICONS: Record<string, typeof Bell> = {
  'critical-stock': AlertTriangle,
  'dead-stock': Archive,
  'sales-spike': TrendingUp,
  rule: Radar,
};

const absoluteFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export function NotificationRow({
  item,
  now,
  onNavigate,
}: {
  item: NotificationItem;
  now: number;
  onNavigate: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  // Hairline satırın değil kaydırma kökünün (SwipeableList) — okunmamış tonu
  // içerikte kalır ki kaydırma yüzeyi opak kalsın.
  const rowClass = `flex gap-2.5 px-4 py-3 ${item.read ? '' : 'bg-accent/40'}`;

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
          <span className="block size-2 rounded-full bg-status-critical" aria-hidden />
          <span className="sr-only">Okunmamış</span>
        </span>
      )}
    </>
  );

  if (!item.productId) {
    // Ürünsüz satır gezinmez ama klavyeyle ulaşılır: oklar rayı açar.
    return (
      <div role="group" tabIndex={0} aria-label={item.title} className={`${rowClass} ${FOCUS_RING_CLASS}`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/dashboard/stok?product=${item.productId}`}
      onClick={() => onNavigate(item.id)}
      // Yerli bağlantı sürüklemesi kaydırma jestini iptal eder.
      draggable={false}
      className={`${rowClass} transition-colors duration-150 hover:bg-muted ${FOCUS_RING_CLASS}`}
    >
      {content}
    </Link>
  );
}

/**
 * Bildirim listesi — kaydırmalı satırlar (DESIGN.md §5 "Kaydırmalı liste"):
 * sağa kaydır → okundu/okunmadı, sola kaydır → kaldır.
 */
export function NotificationSwipeList({
  items,
  now,
  value,
  onValueChange,
  onNavigate,
  onToggleRead,
  onDismiss,
  'aria-label': ariaLabel,
}: {
  items: NotificationItem[];
  now: number;
  value: SwipeableListValue | null;
  onValueChange: (value: SwipeableListValue | null) => void;
  onNavigate: (id: string) => void;
  onToggleRead: (id: string) => void;
  onDismiss: (id: string) => void;
  'aria-label'?: string;
}) {
  const swipeItems = useMemo<SwipeableListItem<NotificationItem>[]>(
    () =>
      items.map(item => ({
        id: item.id,
        data: item,
        leftActions: [
          {
            id: 'read',
            label: item.read ? 'Okunmadı işaretle' : 'Okundu işaretle',
            icon: item.read ? <Mail aria-hidden /> : <MailOpen aria-hidden />,
            onClick: () => onToggleRead(item.id),
          },
        ],
        rightActions: [
          {
            id: 'dismiss',
            label: 'Kaldır',
            icon: <Trash2 aria-hidden />,
            tone: 'danger',
            onClick: () => onDismiss(item.id),
          },
        ],
      })),
    [items, onToggleRead, onDismiss],
  );

  return (
    <SwipeableList
      items={swipeItems}
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      renderItem={it => <NotificationRow item={it.data} now={now} onNavigate={onNavigate} />}
    />
  );
}
