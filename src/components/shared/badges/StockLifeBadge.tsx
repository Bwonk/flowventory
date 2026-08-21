import { Badge, type BadgeSize, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StockLifeBadgeProps {
  /** Stok ömrü (gün). null = satış yok, ömür hesaplanamıyor. */
  days: number | null;
  size?: BadgeSize;
  className?: string;
}

/** Gün sayısına göre varyant: ≤14 kritik, ≤30 uyarı, üzeri sağlıklı, satışsız nötr. */
function variantFor(days: number | null): BadgeVariant {
  if (days === null) return 'neutral';
  if (days <= 14) return 'critical';
  if (days <= 30) return 'warning';
  return 'success';
}

/** Kademe kelimesi tooltip'te taşınır — hücre tek satır kalır. */
function tierFor(days: number | null): string {
  if (days === null) return 'Satış yok';
  if (days <= 14) return 'Kritik';
  if (days <= 30) return 'Yakında biter';
  if (days > 365) return 'Fazla stok';
  return 'Yeterli';
}

/**
 * Stok ömrü rozeti — mevcut stoğun kaç günlük satışa yettiğini renk koduyla gösterir.
 * 365 günden uzun tahminler "365+ gün" tavanıyla gösterilir.
 */
export function StockLifeBadge({ days, size = 'sm', className }: StockLifeBadgeProps) {
  const label =
    days === null ? 'satışsız' : days > 365 ? '365+ gün' : `${days.toLocaleString('tr-TR')} gün`;

  return (
    <Badge variant={variantFor(days)} size={size} title={tierFor(days)} className={cn('tabular-nums', className)}>
      {label}
    </Badge>
  );
}
